# MastraCode Desktop Alpha

Electron host for the shared MastraCode React application. Electron Vite compiles the desktop renderer directly from shared source, and a loopback-only local server in an Electron utility process serves the packaged renderer and API. It is not a webview, does not copy the web build, and does not depend on a remote web deployment.

## Architecture

- `mastracode/sdk` owns the agent runtime, providers, models, tools, auth storage, hooks, MCP, and plugins.
- `mastracode/app` owns the shared React workbench, UI tests, host contract, and wire types used by the renderer.
- `mastracode/web` owns the web composition root, deployable server, and the narrow server surface reused by desktop.
- `mastracode/desktop` owns the desktop composition root, Electron lifecycle, preload IPC, project-directory approval, isolated local serving, packaging, and installed-app tests.

The web and desktop renderers compile the same `@mastra/code-app` source with target-specific entrypoints. Desktop injects native capabilities through a discriminated host contract; the shared app never imports Electron or IPC channel names.

The Electron main process owns only windows, lifecycle, security policy, and native dialogs. A dedicated utility process owns the Mastra runtime, tool execution, and authenticated loopback API so backend work cannot block the browser process. Their internal request protocol is discriminated, runtime-validated, and limited to startup, shutdown, and directory approval.

The preload exposes only app metadata and the native project directory picker. Project paths outside the app's private data directory must be approved through that picker and are persisted under Electron's user-data directory. All file and agent operations continue through the authenticated local API rather than broad filesystem IPC.

## Development

```sh
pnpm desktop:setup
pnpm check
pnpm lint
pnpm test
pnpm desktop:dev
```

`desktop:setup` installs the monorepo and the three standalone MastraCode roots. Desktop build commands then run a narrow cached Turbo prebuild for the linked runtime and renderer dependencies before Electron Vite.

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
