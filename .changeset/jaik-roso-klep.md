---
'@mastra/core': minor
'@mastra/agent-browser': minor
'@mastra/stagehand': minor
---

Added `profile` and `executablePath` options for browser automation.

**What changed**

- Added `profile` option to specify a browser profile directory for persistent sessions (cookies, localStorage, extensions)
- Added `executablePath` option to use a custom browser executable (Chrome, Brave, Edge, etc.)
- Added `storageState` option to `@mastra/agent-browser` for Playwright storage state files
- These options enable using existing browser sessions, extensions, and saved credentials

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
