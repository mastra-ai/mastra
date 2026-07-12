# MastraCode App

Shared React application used by the MastraCode web and desktop composition roots.

## Boundaries

- This package owns the workbench UI, renderer-side API contracts, host capability contract, and UI tests.
- `mastracode/web` mounts it with the web host and owns web deployment and server composition.
- `mastracode/desktop` mounts it with the desktop host and owns Electron, preload, native capabilities, and packaging.
- `mastracode/sdk` remains the source of truth for agent runtime, providers, models, tools, and authentication.

Host-specific behavior must enter through `MastraCodeHost`. Shared UI code must not import Electron, preload internals, IPC channel names, or web server modules.

## Checks

```sh
pnpm install
pnpm check
pnpm lint
pnpm test
```
