---
'@mastra/code-sdk': minor
---

Added host-provided session instructions so workspace-free agent sessions can receive purpose-specific guidance.

```ts
createMastraCodeAgentController({
  hostInstructions: 'Help operators inspect and repair Factory state.',
});
```
