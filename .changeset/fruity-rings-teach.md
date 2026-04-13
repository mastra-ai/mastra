---
'@mastra/core': minor
---

Added `profile` and `executablePath` options to browser config for persistent sessions and custom browser support.

**`profile`** — Path to a browser profile directory. Use this to persist cookies, localStorage, and extensions across sessions.

**`executablePath`** — Path to a custom browser executable. Use this to launch Brave, Edge, Arc, or a specific Chrome installation instead of the bundled Chromium.

```ts
const browser = new AgentBrowser({
  profile: '~/.my-browser-profile',
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
```

Also added `cleanupProfileLockFiles()` to automatically remove stale Chrome lock files (`SingletonLock`, `SingletonSocket`, `SingletonCookie`) when the browser closes, preventing "profile is already in use" errors on next launch.
