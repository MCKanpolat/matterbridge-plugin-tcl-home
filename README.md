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
- Online status → endpoint reachability

Air-quality and filter fields are parsed defensively, but are not exposed as separate Matter sensor endpoints until their exact runtime cluster API and Breeva payloads are confirmed.

## Known limitations / real-device testing needed

The TCL Home API is unofficial and reverse-engineered. Exact Breeva shadow keys can differ by region and firmware; aliases and TODOs are isolated in `src/breeva-map.ts`. AWS IoT shadow credentials and command payloads must be tested against a real account/device. Apple Home may hide some advanced Matter controls. Auto-mode and fan-speed enum values may require adjustment after observing an A2 shadow.

Do not use a primary TCL account if possible. TCL may change or restrict this private API without notice.

## License

Apache License 2.0. See [`LICENSE`](./LICENSE).
