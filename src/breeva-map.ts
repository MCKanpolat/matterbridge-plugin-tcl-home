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

export type BreevaFunction = keyof typeof BREEVA_FUNCTIONS;

export function isSupportedBreeva(deviceName?: string): boolean {
  return deviceName?.toUpperCase().includes("BREEVA") ?? false;
}

export function firstValue(data: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) if (data[key] !== undefined && data[key] !== null) return data[key];
  return undefined;
}
