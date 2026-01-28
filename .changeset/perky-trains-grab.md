---
'@mastra/core': patch
---

Fixed type error when passing MastraVoice implementations (like OpenAIVoice) directly to Agent's voice config. Previously, the voice property only accepted CompositeVoice, requiring users to wrap their voice provider. Now you can pass any MastraVoice implementation directly.

**Before (required wrapper):**

```typescript
const agent = new Agent({
  voice: new CompositeVoice({ output: new OpenAIVoice() }),
});
```

**After (direct usage):**

```typescript
const agent = new Agent({
  voice: new OpenAIVoice(),
});
```

Fixes #12293
