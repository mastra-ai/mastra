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
- Added comprehensive JSDoc documentation with platform-specific examples

### `@mastra/agent-browser`
- Added `storageState` option for Playwright storage state files (lighter-weight alternative to `profile`)
- Updated `launchBrowser()` to pass `profile` and `executablePath` to Playwright
- Uses `chromium.launchPersistentContext()` when `profile` is specified
- Updated `ThreadManager.createSession()` to support these options for per-thread browsers

### `@mastra/stagehand`
- Added `preserveUserDataDir` option - whether to keep profile data after browser closes
- Updated `buildStagehandOptions()` to pass `profile` (as `userDataDir`), `executablePath`, and `preserveUserDataDir` to Stagehand
- Auto-creates profile directory if it doesn't exist

**Example usage:**

```ts
// AgentBrowser with profile and executable
const browser = new AgentBrowser({
  profile: '~/.mastracode/browser-profile',
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  storageState: './auth-state.json', // Optional: Playwright storage state
});

// Stagehand with profile persistence
const stagehand = new StagehandBrowser({
  profile: '/path/to/profile',
  executablePath: '/usr/bin/brave-browser',
  preserveUserDataDir: true, // Keep profile after close
});
```
