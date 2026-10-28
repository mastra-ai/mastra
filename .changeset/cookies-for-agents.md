---
'@mastra/core': minor
---

Added `setCookies()` to `MastraBrowser`, so your app can sign a thread's browser in to a site the agent can't sign in to itself, such as a preview behind your own login. The cookie value never passes through the model. Cookies set before the browser opens are added when it does.

```ts
await browser.setCookies([{ name: 'my_app_session', value: token, domain: 'app.example.com', path: '/' }], threadId);
```

Browser providers that don't support cookies throw. Custom providers can add support by overriding `addCookiesToOpenBrowser()` and calling `addPendingCookies(threadId)` once a thread's browser opens, before it loads a page.
