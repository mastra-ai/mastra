---
'@mastra/core': patch
---

Fixed `result.text` being blanked when an output processor trips the wire from `processOutputResult`, while `result.steps[].text` and `result.response.messages` still contained the full answer. After a tripwire, `text`, `steps[].text`, `getFullOutput().text` and `response.messages` now agree, and the rejection is reported through `result.tripwire`.

```ts
const result = await agent.generate('...');
if (result.tripwire) {
  // result.text still holds the rejected answer for logging or review
}
```
