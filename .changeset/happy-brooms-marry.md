---
'@mastra/code-sdk': patch
---

Mastra Code SDK hosts can now control thread-title style or language by setting `titleInstructions` (#24688):

```ts
const controller = await createMastraCodeAgentController({
  titleInstructions: "Write thread titles in the user's language.",
});
```

When omitted, the default title instructions apply.
