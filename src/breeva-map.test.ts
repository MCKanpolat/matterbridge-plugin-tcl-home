import { describe, expect, it } from "vitest";
import { firstValue, isSupportedBreeva, mapBreevaPercentToSpeed } from "./breeva-map.js";

describe("Breeva mapping", () => {
  it("recognizes supported Breeva products", () => {
    expect(isSupportedBreeva("breeva A2")).toBe(true);
    expect(isSupportedBreeva("Breeva Air Purifier A5")).toBe(true);
    expect(isSupportedBreeva("SMART TV")).toBe(false);
  });

  it("uses the first available API alias", () => {
    expect(firstValue({ fanSpeed: 2 }, ["windSpeed", "fanSpeed"])).toBe(2);
    expect(firstValue({ windSpeed: null, fanSpeed: 2 }, ["windSpeed", "fanSpeed"])).toBe(2);
    expect(firstValue({ windSpeed: 0, fanSpeed: 2 }, ["windSpeed", "fanSpeed"])).toBe(0);
    expect(firstValue({}, ["windSpeed", "fanSpeed"])).toBeUndefined();
  });

  it("maps Matter percentages to Breeva's four discrete speeds", () => {
    expect(mapBreevaPercentToSpeed(0)).toBe(0);
    expect(mapBreevaPercentToSpeed(25)).toBe(0);
    expect(mapBreevaPercentToSpeed(45)).toBe(1);
    expect(mapBreevaPercentToSpeed(75)).toBe(2);
    expect(mapBreevaPercentToSpeed(100)).toBe(3);
    expect(mapBreevaPercentToSpeed("not-a-number")).toBeUndefined();
    expect(mapBreevaPercentToSpeed(-10)).toBe(0);
  });
});
