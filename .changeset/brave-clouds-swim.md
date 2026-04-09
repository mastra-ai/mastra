---
'mastracode': minor
---

Added `/browser set` command, wizard prompts for advanced options, and browser profile support.

**Interactive wizard improvements:**

- Added "Configure advanced options?" step with three choices:
  - **No** — Use defaults (recommended)
  - **Custom browser** — Set executable path, profile directory, and storage state
  - **Connect to running** — Connect via CDP URL to an already-running browser
- Text input prompts for paths and URLs
- Auto-sets `preserveUserDataDir: true` when profile is configured (Stagehand)
- Shows all configured options in summary output

**New `/browser set` command:**

- `/browser set profile <path>` - Set browser profile directory
- `/browser set executablePath <path>` - Set custom browser executable
- `/browser set storageState <path>` - Set Playwright storage state file (agent-browser only)
- `/browser set cdpUrl <url>` - Set CDP WebSocket URL
- `/browser set <key> clear` - Remove a setting

**Browser settings updates:**

- Added `profile` and `executablePath` to `BrowserSettings` interface
- Added `AgentBrowserSettings` interface with `storageState` option
- Added `preserveUserDataDir` to `StagehandSettings` interface
- Auto-sets `preserveUserDataDir` when profile is set via wizard or `/browser set`

**Status display improvements:**

- Shows `profile` path when configured
- Shows `executablePath` when configured  
- Shows `storageState` when configured (agent-browser)
- Shows `cdpUrl` when configured
