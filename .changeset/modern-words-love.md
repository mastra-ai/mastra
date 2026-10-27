---
'@mastra/server': patch
---

Fixed HTTP agent observation to emit public stream frames directly instead of internal PubSub envelopes, restoring text, tool results, and finish metadata when reconnecting. Update consumers of `/observe` to read the public frame directly:

```ts
// Before
const text = event.data.payload.text;
```

```ts
// After
const text = event.payload.text;
```

Raw PubSub events and inclusive replay offsets are unchanged.
