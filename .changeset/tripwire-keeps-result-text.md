---
'@mastra/core': patch
---

`result.text` now keeps the answer when an output processor trips the wire. It matches `result.steps[].text`, `getFullOutput().text` and `result.response.messages`. Check `result.tripwire` to see whether the output was rejected.

```ts
const result = await agent.generate('...');
if (result.tripwire) {
  // result.text still holds the rejected answer for logging or review
}
```
