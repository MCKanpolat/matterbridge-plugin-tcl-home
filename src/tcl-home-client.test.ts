import { describe, expect, it } from "vitest";
import { buildBreevaShadowDesired, TclHomeClient } from "./tcl-home-client.js";

const createClient = (): TclHomeClient =>
  new TclHomeClient(
    {
      username: "test-user",
      password: "test-password",
      appLoginUrl: "https://example.test/login",
      cloudUrl: "https://example.test/cloud-url",
    },
    () => undefined,
  );

describe("TCL Home state extraction", () => {
  it("extracts the Breeva A2 fields from a reported shadow", () => {
    const client = createClient();

    expect(
      client.extractState({
        state: {
          reported: {
            powerSwitch: 1,
            windSpeed: 3,
            workMode: 0,
            PM25SensorLevel: 2,
            filterLifeTime: 86,
            filterReplace: 0,
            screenSwitch: 1,
            anionSwitch: 0,
            childLockSwitch: 1,
            timerRemaining: 120,
            panelLightAutoOFF: 1,
            favouriteModeSwitch: 0,
          },
        },
      }),
    ).toEqual({
      power: 1,
      fanSpeed: 3,
      mode: 0,
      airQuality: 2,
      filterLife: 86,
      filterWarning: 0,
      screen: 1,
      anion: 0,
      childLock: 1,
      timer: 120,
      panelLightAutoOff: 1,
      favoriteMode: 0,
    });
  });

  it("supports top-level payloads and API aliases", () => {
    const client = createClient();

    expect(
      client.extractState({
        power: 0,
        speed: 2,
        mode: "auto",
        air_quality: 1,
        filter_remaining: 42,
        filter_warning: true,
        ionizerSwitch: "on",
      }),
    ).toMatchObject({
      power: 0,
      fanSpeed: 2,
      mode: "auto",
      airQuality: 1,
      filterLife: 42,
      filterWarning: true,
      anion: "on",
    });
  });

  it("returns undefined for fields missing from an incomplete response", () => {
    expect(
      new TclHomeClient(
        {
          username: "test-user",
          password: "test-password",
          appLoginUrl: "https://example.test/login",
          cloudUrl: "https://example.test/cloud-url",
        },
        () => undefined,
      ).extractState({ state: { reported: {} } }),
    ).toEqual({
      power: undefined,
      fanSpeed: undefined,
      mode: undefined,
      airQuality: undefined,
      filterLife: undefined,
      filterWarning: undefined,
      screen: undefined,
      anion: undefined,
      childLock: undefined,
      timer: undefined,
      panelLightAutoOff: undefined,
      favoriteMode: undefined,
    });
  });
});

describe("Breeva shadow commands", () => {
  it.each([
    [25, 0, 1],
    [50, 1, 2],
    [75, 2, 2],
    [100, 3, 2],
  ])("maps %s%% to windSpeed %s and workMode %s", (percent, windSpeed, workMode) => {
    expect(buildBreevaShadowDesired({ fanSpeed: percent })).toEqual({
      windSpeed,
      workMode,
    });
  });

  it("maps Auto without overriding it with a fan speed", () => {
    expect(buildBreevaShadowDesired({ mode: "auto" })).toEqual({ workMode: 0 });
  });

  it("maps power and optional Breeva controls to their shadow keys", () => {
    expect(
      buildBreevaShadowDesired({
        power: 0,
        screen: false,
        anion: true,
        childLock: "on",
        timer: "120",
        panelLightAutoOff: 0,
        favoriteMode: 1,
      }),
    ).toEqual({
      powerSwitch: 0,
      screenSwitch: 0,
      anionSwitch: 1,
      childLockSwitch: 1,
      timerRemaining: 120,
      panelLightAutoOFF: 0,
      favouriteModeSwitch: 1,
    });
  });
});
