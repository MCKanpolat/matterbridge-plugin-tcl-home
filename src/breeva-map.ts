export const BREEVA_PRODUCT_KEYS = ["BREEVA_A2", "BREEVA_A3", "BREEVA_A5", "A2", "A3", "A5"];

/** API aliases observed in TCL Home payloads. Confirm exact keys with a real device. */
export const BREEVA_FUNCTIONS = {
  power: ["power", "Power", "switchPower", "SWITCH_POWER"],
  fanSpeed: ["windSpeed", "fanSpeed", "speed", "SELECT_WIND_SPEED"],
  mode: ["workMode", "mode", "work_mode", "SELECT_MODE"],
  airQuality: ["airQuality", "air_quality", "pm25", "pm2_5", "PM2.5"],
  filterLife: ["filterLife", "filter_life", "filterRemain", "filter_remaining"],
  filterWarning: ["filterWarning", "filter_warning", "filterReplace"],
} as const;

export type BreevaFunction = keyof typeof BREEVA_FUNCTIONS;

export function isSupportedBreeva(
  productKey?: string,
  category?: string,
  deviceType?: string,
): boolean {
  const text = [productKey, category, deviceType].filter(Boolean).join(" ").toUpperCase();
  return text.includes("BREEVA") || BREEVA_PRODUCT_KEYS.some((key) => text.includes(key));
}

export function firstValue(data: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) if (data[key] !== undefined && data[key] !== null) return data[key];
  return undefined;
}
