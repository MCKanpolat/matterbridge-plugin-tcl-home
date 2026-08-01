import fs from "node:fs";
import { TclHomeClient } from "../dist/tcl-home-client.js";

const configPath =
  process.env.MATTERBRIDGE_CONFIG ??
  "/home/node/.matterbridge/matterbridge-plugin-tcl-home.config.json";
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const client = new TclHomeClient(
  {
    username: config.username,
    password: config.password,
    appLoginUrl: config.appLoginUrl,
    cloudUrl: config.cloudUrl,
    pollInterval: config.pollInterval,
    debug: false,
  },
  () => {},
);

const devices = await client.discover();
if (!devices[0]) throw new Error("No supported Breeva device found");
const device = devices[0];
const wait = () => new Promise((resolve) => setTimeout(resolve, 2000));
const read = async () => {
  const shadow = await client.readState(device);
  return shadow.state?.reported ?? shadow.reported ?? shadow;
};
const print = (label, state, keys) =>
  console.log(label, JSON.stringify(Object.fromEntries(keys.map((key) => [key, state[key]]))));
const test = async (label, command, keys) => {
  await client.sendCommand(device, command);
  await wait();
  print(label, await read(), keys);
};

const initial = await read();
const original = {
  power: initial.powerSwitch,
  fanSpeed: initial.windSpeed,
  mode: initial.workMode,
  screen: initial.screenSwitch,
  anion: initial.anionSwitch,
  childLock: initial.childLockSwitch,
  timer: initial.timerRemaining,
  panelLightAutoOff: initial.panelLightAutoOFF,
  favoriteMode: initial.favouriteModeSwitch,
};

console.log(`Testing ${device.deviceName ?? "Breeva device"}`);
print("initial", initial, [
  "powerSwitch",
  "windSpeed",
  "workMode",
  "screenSwitch",
  "anionSwitch",
  "childLockSwitch",
  "timerRemaining",
  "panelLightAutoOFF",
  "favouriteModeSwitch",
]);

try {
  await test("power_off", { power: 0 }, ["powerSwitch"]);
  await test("power_on", { power: 1 }, ["powerSwitch"]);
  for (const percent of [25, 50, 75, 100])
    await test(`fan_percent_${percent}`, { fanSpeed: percent }, ["windSpeed"]);
  await test("mode_2", { mode: 2 }, ["workMode"]);
  await test("mode_auto", { mode: "auto" }, ["workMode"]);
  await test("screen_off", { screen: 0 }, ["screenSwitch"]);
  await test("screen_on", { screen: 1 }, ["screenSwitch"]);
  await test("anion_off", { anion: 0 }, ["anionSwitch"]);
  await test("anion_on", { anion: 1 }, ["anionSwitch"]);
  await test("child_lock_on", { childLock: 1 }, ["childLockSwitch"]);
  await test("child_lock_off", { childLock: 0 }, ["childLockSwitch"]);
  await test("timer_60", { timer: 60 }, ["timerRemaining"]);
  await test("timer_0", { timer: 0 }, ["timerRemaining"]);
  await test("panel_light_auto_on", { panelLightAutoOff: 1 }, ["panelLightAutoOFF"]);
  await test("panel_light_auto_off", { panelLightAutoOff: 0 }, ["panelLightAutoOFF"]);
  await test("favorite_mode_on", { favoriteMode: 1 }, ["favouriteModeSwitch"]);
  await test("favorite_mode_off", { favoriteMode: 0 }, ["favouriteModeSwitch"]);
} finally {
  if (original.power !== undefined) {
    await client.sendCommand(device, { power: original.power });
    await wait();
  }
  if (original.fanSpeed !== undefined && original.mode !== 0) {
    await client.sendCommand(device, { fanSpeed: Number(original.fanSpeed) * 25 });
    await wait();
  }
  if (original.mode !== undefined) {
    await client.sendCommand(device, { mode: original.mode });
    await wait();
  }
  if (original.screen !== undefined) {
    await client.sendCommand(device, { screen: original.screen });
    await wait();
  }
  if (original.anion !== undefined) {
    await client.sendCommand(device, { anion: original.anion });
    await wait();
  }
  if (original.childLock !== undefined) {
    await client.sendCommand(device, { childLock: original.childLock });
    await wait();
  }
  if (original.timer !== undefined) {
    await client.sendCommand(device, { timer: original.timer });
    await wait();
  }
  if (original.panelLightAutoOff !== undefined) {
    await client.sendCommand(device, { panelLightAutoOff: original.panelLightAutoOff });
    await wait();
  }
  if (original.favoriteMode !== undefined) {
    await client.sendCommand(device, { favoriteMode: original.favoriteMode });
    await wait();
  }
  print("restored", await read(), [
    "powerSwitch",
    "windSpeed",
    "workMode",
    "screenSwitch",
    "anionSwitch",
    "childLockSwitch",
    "timerRemaining",
    "panelLightAutoOFF",
    "favouriteModeSwitch",
  ]);
}
