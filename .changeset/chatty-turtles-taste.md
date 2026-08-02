---
'@mastra/core': patch
---

Fixed TokenLimiter silently dropping agent output when used as an output processor. It counted every stream part — including lifecycle parts like `step-start` (which embeds the full serialized request) and reasoning deltas — so a realistic limit could be exhausted before any answer text arrived. Once the limit was hit, all later parts were withheld, including `tool-call` parts, so agents returned empty text or stopped executing tools with no error.

Now only generated output counts against the limit (text and object parts), tool and lifecycle parts always pass through, and the first time output is withheld the processor emits a transient `data-token-limit-reached` part so truncation is visible:

```typescript
for await (const part of stream.fullStream) {
  if (part.type === 'data-token-limit-reached') {
    console.log('output truncated at', part.data.limit, 'tokens');
  }
}
```

Fixes #20250
