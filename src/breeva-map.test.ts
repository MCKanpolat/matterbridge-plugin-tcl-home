import { describe, expect, it } from "vitest";
import { firstValue, isSupportedBreeva } from "./breeva-map.js";

describe("Breeva mapping", () => {
  it("recognizes supported Breeva products", () => {
    expect(isSupportedBreeva("BREEVA_A2")).toBe(true);
    expect(isSupportedBreeva("BREEVA_A5")).toBe(true);
    expect(isSupportedBreeva("SMART_TV")).toBe(false);
  });

  it("uses the first available API alias", () => {
    expect(firstValue({ fanSpeed: 2 }, ["windSpeed", "fanSpeed"])).toBe(2);
    expect(firstValue({}, ["windSpeed", "fanSpeed"])).toBeUndefined();
  });
});
