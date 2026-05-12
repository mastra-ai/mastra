---
'@mastra/core': patch
---

Added support for attaching a browser instance to the harness after initialization so consumers can defer browser creation until it is needed:

```ts
const harness = new Harness({ agent, mastra });
await harness.init();
harness.setBrowser(browser);
```
