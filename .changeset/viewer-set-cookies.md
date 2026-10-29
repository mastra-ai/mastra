---
'@mastra/browser-viewer': minor
---

Added `setCookies()` support to `BrowserViewer`. Cookies set before a thread's browser opens are added before it loads any page, so pages open signed in.

```ts
await browser.setCookies([{ name: 'my_app_session', value: token, domain: 'app.example.com', path: '/' }], threadId);
```
