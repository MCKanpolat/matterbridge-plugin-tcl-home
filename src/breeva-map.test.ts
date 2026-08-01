import { describe, expect, it } from "vitest";
import { firstValue, isSupportedBreeva } from "./breeva-map.js";

describe("Breeva mapping", () => {
  it("recognizes supported Breeva products", () => {
    expect(isSupportedBreeva("breeva A2")).toBe(true);
    expect(isSupportedBreeva("Breeva Air Purifier A5")).toBe(true);
    expect(isSupportedBreeva("SMART TV")).toBe(false);
  });

  it("uses the first available API alias", () => {
    expect(firstValue({ fanSpeed: 2 }, ["windSpeed", "fanSpeed"])).toBe(2);
    expect(firstValue({}, ["windSpeed", "fanSpeed"])).toBeUndefined();
  });
});
