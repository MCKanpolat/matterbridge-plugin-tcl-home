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
  for (const speed of [1, 2, 3, 4]) await test(`fan_${speed}`, { fanSpeed: speed }, ["windSpeed"]);
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
  await client.sendCommand(
    device,
    Object.fromEntries(Object.entries(original).filter(([, value]) => value !== undefined)),
  );
  await wait();
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
