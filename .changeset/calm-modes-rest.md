---
'@mastra/code-sdk': minor
---

Added a `thinkingResolution` option to `createMastraCodeAgentController`. A host that owns its thinking default passes `defaultLevel`, and every run without a session override uses that level. The shared settings file is not read for it.

```typescript
const controller = await createMastraCodeAgentController({
  thinkingResolution: { defaultLevel: 'medium' },
});
```
