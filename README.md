# matterbridge-plugin-tcl-home

Unofficial, cloud-based Matterbridge integration for TCL Home devices. The initial MVP exposes TCL Breeva A2/A3/A5 air purifiers as Matter air-purifier/fan endpoints, prioritising power and fan control.

## Install

```bash
npm install --omit=dev
matterbridge --add matterbridge-plugin-tcl-home
```

For local development:

```bash
npm install
npm run build
matterbridge --add .
```

## Configuration

Copy [`matterbridge-plugin-tcl-home.config.json`](./matterbridge-plugin-tcl-home.config.json) into the Matterbridge plugin configuration and set `username` and `password`. The JSON schema is in [`matterbridge-plugin-tcl-home.schema.json`](./matterbridge-plugin-tcl-home.schema.json).

```json
{
  "name": "matterbridge-plugin-tcl-home",
  "type": "DynamicPlatform",
  "username": "tcl-home-user@example.com",
  "password": "replace-me",
  "pollingInterval": 60,
  "whiteList": [],
  "blackList": [],
  "debug": false
}
```

`appLoginUrl` and `cloudUrl` are optional overrides. Credentials are never written to logs.

## Local debugging

Set `debug` to `true` in the Matterbridge plugin configuration. The plugin then logs TCL HTTP status codes, endpoint paths, response summaries, device discovery data, and AWS shadow responses. Passwords, tokens, AWS credentials, and authorization values are redacted and response output is truncated.

With the DevContainer running:

```bash
npm link matterbridge
npm run build
npm run add
npm run start -- --logger debug --fixed_delay 0 --frontend 8283
```

Open `http://localhost:8283`, configure the plugin, and watch the terminal output. Do not paste credentials into shell commands or commit the generated Matterbridge configuration.

### Breeva A2 live test

The repository contains a real-device test at [`live-tests/live-test-breeva-a2.mjs`](./live-tests/live-test-breeva-a2.mjs). It exercises power, fan speeds, modes, screen, anion, child lock, timer, panel light, and favorite mode, then restores the initial state.

Run it only when the Breeva A2 can safely be controlled:

```bash
npm run live-test:breeva-a2
```

The script reads the Matterbridge configuration at runtime. It contains no credentials and does not print passwords, tokens, or AWS credentials. Override the config path with `MATTERBRIDGE_CONFIG` when needed.

## iHost / Docker

The plugin needs outbound HTTPS access to TCL Home and AWS endpoints. In Docker or iHost, ensure the container has DNS, internet access, and persistent Matterbridge storage. The integration is cloud-based; local LAN access to the purifier is not used.

## Supported devices and mapping

- TCL Breeva Air Purifier A2 (initial target)
- Breeva A3 and A5 are accepted by the same guarded mapping and need real-device validation
- Power → Matter OnOff
- Fan speed and auto mode → Matter FanControl
- Fan percentage is mapped to Breeva's discrete steps: 25% Sleep, 50% Low, 75% Mid, and 100% High; intermediate values use the nearest step
- Online status → endpoint reachability
- Apple Home command bursts are serialized and coalesced before cloud publish

Air-quality and filter fields are parsed defensively, but are not exposed as separate Matter sensor endpoints until their exact runtime cluster API and Breeva payloads are confirmed.

## Validation status and known limitations

The Breeva A2 integration has been tested against a real device, including TCL Home login and discovery, power, Auto mode, Sleep, Low, Mid, and High fan speeds, screen, Anion Sterilization, child lock, timer, panel-light settings, and favorite mode. The discrete A2 fan mapping was validated as 25% Sleep, 50% Low, 75% Mid, and 100% High. The live-test script restores the device's initial state after testing.

The TCL Home API is unofficial and reverse-engineered. Exact shadow keys can still differ by region or firmware; aliases and TODOs are isolated in `src/breeva-map.ts`. The current real-device validation covers Breeva A2 only; Breeva A3 and A5 still need device-specific validation. Air quality and filter fields are parsed defensively but are not currently exposed as Matter sensor endpoints. Apple Home may hide some advanced Matter controls or display a certification warning.

Do not use a primary TCL account if possible. TCL may change or restrict this private API without notice.

## License

Apache License 2.0. See [`LICENSE`](./LICENSE).
