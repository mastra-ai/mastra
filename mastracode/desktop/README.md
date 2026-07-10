# MastraCode Desktop Alpha

Electron host for the MastraCode web interface. The renderer is the compiled `mastracode/web` UI, served from packaged resources by a loopback-only local server. It is not a webview and does not depend on a remote web deployment.

## Architecture

- `mastracode/sdk` owns the agent runtime, providers, models, tools, auth storage, hooks, MCP, and plugins.
- `mastracode/web` owns the React interface and exports narrow desktop host and server surfaces.
- `mastracode/desktop` owns Electron lifecycle, preload IPC, project-directory approval, local serving, packaging, and installed-app tests.

The preload exposes only app metadata and the native project directory picker. Project paths outside the app's private data directory must be approved through that picker and are persisted under Electron's user-data directory.

## Development

```sh
pnpm install
pnpm check
pnpm lint
pnpm test
pnpm desktop:dev
```

## Local macOS alpha

```sh
pnpm desktop:install:alpha
pnpm desktop:e2e:installed
```

The local alpha is installed to `/Applications/MastraCode Desktop Alpha.app` with an ad-hoc signature. This is for local testing only.

## Signed macOS release

`pnpm desktop:release:mac` creates notarized DMG and ZIP artifacts. It requires a Developer ID signing identity and one electron-builder-supported notarization credential set:

- `APPLE_API_KEY`, `APPLE_API_KEY_ID`, and `APPLE_API_ISSUER`
- `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`
- `APPLE_KEYCHAIN` and `APPLE_KEYCHAIN_PROFILE`

The release build fails instead of silently publishing an unsigned or unnotarized artifact.
