---
'@mastra/core': minor
'@mastra/agent-browser': minor
'@mastra/stagehand': minor
---

Added `profile` and `executablePath` options for browser automation.

**What changed**

### `@mastra/core`
- Added `profile` option to `BrowserConfigBase` - path to browser profile directory for persistent sessions (cookies, localStorage, extensions)
- Added `executablePath` option to `BrowserConfigBase` - path to custom browser executable (Chrome, Brave, Edge, etc.)

### `@mastra/agent-browser`
- Added `storageState` option for Playwright storage state files
- Updated `launchBrowser()` to pass `profile` and `executablePath` to Playwright
- Uses `chromium.launchPersistentContext()` when `profile` is specified
- Updated `ThreadManager.createSession()` to support these options for per-thread browsers

### `@mastra/stagehand`
- Updated `buildStagehandOptions()` to pass `profile` (as `userDataDir`) and `executablePath` to Stagehand

**Example usage:**

```ts
const browser = new AgentBrowser({
  profile: '~/.mastracode/browser-profile',
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});

const stagehand = new StagehandBrowser({
  profile: '/path/to/profile',
  executablePath: '/usr/bin/brave-browser',
});
```
