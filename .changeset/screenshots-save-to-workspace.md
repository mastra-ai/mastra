---
'@mastra/agent-browser': minor
---

`browser_screenshot` can now also save the screenshot as a PNG in the agent's workspace. Pass a `path` and the agent can attach or share the file afterwards without setting up its own browser. Missing folders are created.

```ts
await browser_screenshot({ path: 'screenshots/home.png' });
```
