---
'@mastra/core': minor
'@mastra/agent-browser': minor
'@mastra/stagehand': minor
'@mastra/browser-viewer': minor
---

Added `setCookies()` to browsers, so your app can sign a thread's browser in to a site the agent can't sign in to itself, such as a preview behind your own login. The cookie value never passes through the model. Cookies set before the browser opens are added when it does.

```ts
await browser.setCookies([{ name: 'session', value: token, domain: 'app.example.com', path: '/' }], threadId);
```

`AgentBrowser`, `BrowserViewer`, `FirecrawlBrowser` and `StagehandBrowser` support it. Custom providers can add support by overriding `addCookiesToOpenBrowser()`.
