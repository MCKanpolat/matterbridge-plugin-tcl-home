import {
  airPurifier,
  MatterbridgeDynamicPlatform,
  MatterbridgeEndpoint,
  type BasePlatformConfig,
  type PlatformMatterbridge,
} from "matterbridge";
import type { AnsiLogger, LogLevel } from "matterbridge/logger";
import { BridgedDeviceBasicInformation, FanControl, OnOff } from "matterbridge/matter/clusters";
import { BREEVA_MODES, BREEVA_SPEED_PERCENT, isSupportedBreeva } from "./breeva-map.js";
import { TclHomeClient, type Json, type TclDevice } from "./tcl-home-client.js";

export type TclPlatformConfig = BasePlatformConfig & {
  username: string;
  password: string;
  appLoginUrl?: string;
  cloudUrl?: string;
  pollingInterval?: number;
  whiteList?: string[];
  blackList?: string[];
  debug?: boolean;
};

const boolValue = (value: unknown): boolean =>
  value === true || value === 1 || value === "1" || value === "on" || value === "ON";
const numberValue = (value: unknown): number | undefined =>
  typeof value === "number" ? value : Number.isFinite(Number(value)) ? Number(value) : undefined;
const isAutoFanMode = (value: unknown): boolean =>
  value === FanControl.FanMode.Auto ||
  value === FanControl.FanMode.Smart ||
  String(value).toLowerCase() === "auto";
const mapFanModeToBreeva = (value: unknown): "auto" | number =>
  isAutoFanMode(value) ? "auto" : BREEVA_MODES.manual;

export default function initializePlugin(
  matterbridge: PlatformMatterbridge,
  log: AnsiLogger,
  config: TclPlatformConfig,
): TclPlatform {
  return new TclPlatform(matterbridge, log, config);
}

export class TclPlatform extends MatterbridgeDynamicPlatform {
  private readonly client: TclHomeClient;
  private pollTimer?: ReturnType<typeof setInterval>;
  private updatingMatter = false;
  private readonly devices = new Map<string, { api: TclDevice; endpoint: MatterbridgeEndpoint }>();
  private readonly pendingCommands = new Map<string, Json>();
  private readonly pendingPriorities = new Map<string, "fan" | "mode">();
  private readonly runningCommands = new Set<string>();

  constructor(matterbridge: PlatformMatterbridge, log: AnsiLogger, config: TclPlatformConfig) {
    super(matterbridge, log, config);
    if (
      typeof this.verifyMatterbridgeVersion !== "function" ||
      !this.verifyMatterbridgeVersion("3.10.0")
    )
      throw new Error("This plugin requires Matterbridge >= 3.10.0");
    this.client = new TclHomeClient(
      {
        username: config.username,
        password: config.password,
        appLoginUrl:
          config.appLoginUrl ?? "https://pa.account.tcl.com/account/login?clientId=54148614",
        cloudUrl: config.cloudUrl ?? "https://prod-center.aws.tcljd.com/v3/global/cloud_url_get",
        debug: config.debug,
      },
      (message, error) => (error ? this.log.error(message) : this.log.debug(message)),
    );
  }

  override async onStart(reason?: string): Promise<void> {
    await this.ready;
    await this.clearSelect();
    this.log.info(`TCL Home starting (${reason ?? "startup"})`);
    try {
      await this.discoverDevices();
      this.pollTimer = setInterval(
        () => void this.poll(),
        Math.max(10, Number((this.config as TclPlatformConfig).pollingInterval ?? 60)) * 1000,
      );
    } catch (error) {
      this.log.error(
        `TCL Home discovery failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  override async onConfigure(): Promise<void> {
    await super.onConfigure();
    await this.poll();
  }
  override async onChangeLoggerLevel(_logLevel: LogLevel): Promise<void> {
    /* API logging is controlled by config.debug. */
  }
  override async onShutdown(reason?: string): Promise<void> {
    if (this.pollTimer) clearInterval(this.pollTimer);
    await super.onShutdown(reason);
    if (this.config.unregisterOnShutdown) await this.unregisterAllDevices();
  }

  private allowed(device: TclDevice): boolean {
    const config = this.config as TclPlatformConfig;
    const ids = [device.deviceId, device.deviceName].filter(Boolean) as string[];
    return (
      (!config.whiteList?.length || ids.some((id) => config.whiteList?.includes(id))) &&
      !ids.some((id) => config.blackList?.includes(id))
    );
  }

  private async discoverDevices(): Promise<void> {
    const found = await this.client.discover();
    this.log.info(`TCL Home discovered ${found.length} device(s)`);
    for (const device of found) {
      if (!isSupportedBreeva(device.deviceName)) {
        this.log.warn(
          `Unsupported TCL device ${device.deviceId}: type=${device.deviceType ?? "unknown"} category=${device.category ?? "unknown"} productKey=${device.productKey ?? "unknown"}`,
        );
        continue;
      }
      if (!this.allowed(device) || this.devices.has(device.deviceId)) continue;
      const endpoint = new MatterbridgeEndpoint(airPurifier, { id: device.deviceId })
        .createDefaultBridgedDeviceBasicInformationClusterServer(
          device.deviceName ?? "TCL Breeva",
          device.deviceId,
          this.matterbridge.aggregatorVendorId,
          "TCL",
          "Breeva Air Purifier",
          10000,
          "1.0.0",
        )
        .createDefaultPowerSourceWiredClusterServer()
        .addRequiredClusters()
        .addClusterServers([OnOff.id])
        // Matterbridge updates the command's Matter attributes within its transaction.
        // Calling endpoint.setAttribute() from these handlers would deadlock it.
        .addCommandHandler("on", () => void this.command(device, { power: 1 }))
        .addCommandHandler("off", () => void this.command(device, { power: 0 }))
        .addCommandHandler("step", (data) => {
          if (!this.updatingMatter)
            void this.command(device, {
              fanSpeed: (data.request as { direction?: number }).direction,
            });
        })
        .subscribeAttribute(FanControl, "fanMode", (value) => {
          this.log.debug(`TCL fanMode write for ${device.deviceId}: value=${String(value)}`);
          if (!this.updatingMatter) void this.command(device, { mode: mapFanModeToBreeva(value) });
        })
        .subscribeAttribute(FanControl, "percentSetting", (value) => {
          this.log.debug(`TCL percentSetting write for ${device.deviceId}: value=${String(value)}`);
          // Matter sets PercentSetting to null when FanMode changes to Auto.
          // That is a state transition, not a request to set speed to zero.
          if (!this.updatingMatter && value !== null && value !== undefined)
            void this.command(device, { fanSpeed: value });
        });
      this.setSelectDevice(device.deviceId, device.deviceName ?? device.deviceId);
      if (this.validateDevice([device.deviceName ?? device.deviceId, device.deviceId])) {
        await this.registerDevice(endpoint);
        this.devices.set(device.deviceId, { api: device, endpoint });
      }
    }
    await this.poll();
  }

  private command(device: TclDevice, desired: Json): void {
    const pending = this.pendingCommands.get(device.deviceId) ?? {};
    if (!this.pendingPriorities.has(device.deviceId)) {
      if (desired.mode !== undefined) this.pendingPriorities.set(device.deviceId, "mode");
      else if (desired.fanSpeed !== undefined) this.pendingPriorities.set(device.deviceId, "fan");
    }
    const merged = { ...pending, ...desired };
    // Apple Home may send the current percentSetting together with a mode
    // change. Preserve whichever user action arrived first in that burst.
    const priority = this.pendingPriorities.get(device.deviceId);
    if (priority === "fan" && merged.mode === "auto") delete merged.mode;
    if (priority === "mode" && merged.fanSpeed !== undefined) delete merged.fanSpeed;
    this.pendingCommands.set(device.deviceId, merged);
    if (this.runningCommands.has(device.deviceId)) return;
    this.runningCommands.add(device.deviceId);
    void this.drainCommands(device);
  }
  private async drainCommands(device: TclDevice): Promise<void> {
    try {
      while (this.pendingCommands.has(device.deviceId)) {
        // Apple Home can emit power and fan writes as a short burst. Give the
        // burst a small coalescing window before sending the latest state.
        await new Promise((resolve) => setTimeout(resolve, 100));
        const desired = this.pendingCommands.get(device.deviceId);
        this.pendingCommands.delete(device.deviceId);
        this.pendingPriorities.delete(device.deviceId);
        if (!desired) continue;
        try {
          await this.client.sendCommand(device, desired);
          this.log.info(`TCL command sent to ${device.deviceId}: ${JSON.stringify(desired)}`);
        } catch (error) {
          this.log.error(
            `TCL command failed for ${device.deviceId}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    } finally {
      this.runningCommands.delete(device.deviceId);
      if (this.pendingCommands.has(device.deviceId)) {
        this.runningCommands.add(device.deviceId);
        void this.drainCommands(device);
      }
    }
  }
  private async poll(): Promise<void> {
    for (const item of this.devices.values())
      try {
        const state = this.client.extractState(await this.client.readState(item.api));
        await this.updateMatter(item.endpoint, state, item.api.isOnline);
      } catch (error) {
        this.log.error(
          `TCL state update failed for ${item.api.deviceId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
  }
  private async updateMatter(
    endpoint: MatterbridgeEndpoint,
    state: Json,
    online: boolean,
  ): Promise<void> {
    this.updatingMatter = true;
    try {
      await endpoint.setAttribute(BridgedDeviceBasicInformation, "reachable", online, this.log);
      if (state.power !== undefined)
        await endpoint.setAttribute(OnOff, "onOff", boolValue(state.power), this.log);
      const speed = numberValue(state.fanSpeed);
      if (speed !== undefined)
        await endpoint.setAttribute(
          FanControl,
          "percentCurrent",
          BREEVA_SPEED_PERCENT[Math.round(speed)] ?? Math.max(0, Math.min(100, speed)),
          this.log,
        );
      if (state.mode !== undefined)
        await endpoint.setAttribute(
          FanControl,
          "fanMode",
          String(state.mode).toLowerCase() === "auto" || state.mode === 0
            ? FanControl.FanMode.Auto
            : FanControl.FanMode.Low,
          this.log,
        );
    } finally {
      this.updatingMatter = false;
    }
  }
}
