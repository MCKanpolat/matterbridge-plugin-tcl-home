/** API aliases observed in TCL Home payloads. Confirm exact keys with a real device. */
export const BREEVA_FUNCTIONS = {
  power: ["powerSwitch", "power", "Power", "switchPower", "SWITCH_POWER"],
  fanSpeed: ["windSpeed", "fanSpeed", "speed", "SELECT_WIND_SPEED"],
  mode: ["workMode", "mode", "work_mode", "SELECT_MODE"],
  airQuality: [
    "PM25SensorLevel",
    "VOCSensorLevel",
    "airQuality",
    "air_quality",
    "pm25",
    "pm2_5",
    "PM2.5",
  ],
  filterLife: ["filterLifeTime", "filterLife", "filter_life", "filterRemain", "filter_remaining"],
  filterWarning: ["filterWarning", "filter_warning", "filterReplace"],
  screen: ["screenSwitch", "screen_switch"],
  anion: ["anionSwitch", "anion_switch", "ionizerSwitch"],
  childLock: ["childLockSwitch", "child_lock_switch"],
  timer: ["timerRemaining", "timer_remaining"],
  panelLightAutoOff: ["panelLightAutoOFF", "panelLightAutoOff", "panel_light_auto_off"],
  favoriteMode: ["favouriteModeSwitch", "favoriteModeSwitch", "favourite_mode_switch"],
} as const;

/** Breeva A2 values observed from the real device. */
export const BREEVA_MODES = {
  auto: 0,
  manual: 2,
} as const;

/** Breeva A2 has Sleep plus three higher speeds; TCL accepts values 1..4. */
export const BREEVA_SPEED_PERCENT = [25, 50, 75, 100] as const;

/** Map Matter's continuous percentage setting to the Breeva's four steps. */
export function mapBreevaPercentToSpeed(value: unknown): number | undefined {
  const percent = Number(value);
  if (!Number.isFinite(percent)) return undefined;
  if (percent <= 0) return 0;
  let closest = 1;
  let distance = Math.abs(percent - BREEVA_SPEED_PERCENT[0]!);
  for (let index = 1; index < BREEVA_SPEED_PERCENT.length; index++) {
    const candidateDistance = Math.abs(percent - BREEVA_SPEED_PERCENT[index]!);
    if (candidateDistance < distance) {
      closest = index + 1;
      distance = candidateDistance;
    }
  }
  return closest;
}

export type BreevaFunction = keyof typeof BREEVA_FUNCTIONS;

export function isSupportedBreeva(deviceName?: string): boolean {
  return deviceName?.toUpperCase().includes("BREEVA") ?? false;
}

export function firstValue(data: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) if (data[key] !== undefined && data[key] !== null) return data[key];
  return undefined;
}
