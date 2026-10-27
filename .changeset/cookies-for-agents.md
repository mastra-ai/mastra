---
'@mastra/agent-browser': minor
---

Added `setCookies()` to `AgentBrowser`, so your app can sign a thread's browser in to a site the agent can't sign in to itself. Cookies set before the browser starts are added when it launches.

```ts
await browser.setCookies([{ name: 'session', value: token, domain: 'app.example.com', path: '/' }], threadId);
```
