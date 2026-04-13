---
'@mastra/agent-browser': minor
---

Added `storageState` and `exportStorageState()` for lightweight auth persistence.

**`storageState`** — Path to a Playwright storage state JSON file. A lighter-weight alternative to a full browser profile — saves only cookies and localStorage, not extensions or history.

**`exportStorageState(path)`** — Export the current session's cookies and localStorage to a JSON file for reuse in future sessions.

```ts
// Launch with saved auth
const browser = new AgentBrowser({
  storageState: './auth-state.json',
});

// Save current session for later
await browser.exportStorageState('./auth-state.json');
```

Also kills orphaned Chrome child processes (GPU, renderer, crashpad) on close to prevent zombie processes.
