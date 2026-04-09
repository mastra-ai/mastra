---
'mastracode': minor
---

Added `/browser set` command and browser profile support.

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
- Updated `parseBrowserSettings()` to handle new fields
- Updated `createBrowserFromSettings()` to pass new options to browser providers

**Status display improvements:**

- Shows `profile` path when configured
- Shows `executablePath` when configured  
- Shows `storageState` when configured (agent-browser)
- Shows `cdpUrl` when configured
