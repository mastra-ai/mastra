---
'@mastra/core': patch
---

When using output processors with `agent.generate()`, `result.text` was returning the unprocessed LLM response instead of the processed text.

**Before:**

```ts
const result = await agent.generate('hello');
result.text; // "hello world" (unprocessed)
result.response.messages[0].content[0].text; // "HELLO WORLD" (processed)
```

**After:**

```ts
const result = await agent.generate('hello');
result.text; // "HELLO WORLD" (processed)
```

The bug was caused by the `text` delayed promise being resolved twice - first correctly with the processed text, then overwritten with the unprocessed buffered text. 