---
'@mastra/ai-sdk': patch
---

Added support for tripwire data chunks in streaming responses.

Tripwire chunks allow the AI SDK to emit special data events when certain conditions are triggered during stream processing. These chunks include a `tripwireReason` field explaining why the tripwire was activated.

**Usage:**

When converting Mastra chunks to AI SDK v5 format, tripwire chunks are now automatically handled:

```typescript
// Tripwire chunks are converted to data-tripwire format
const chunk = {
  type: 'tripwire',
  payload: { tripwireReason: 'Rate limit approaching' }
};

// Converts to:
{
  type: 'data-tripwire',
  data: { tripwireReason: 'Rate limit approaching' }
}
