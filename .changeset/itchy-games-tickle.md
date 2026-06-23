---
'@mastra/ai-sdk': patch
---

Hardened the default error serializer used by `chatRoute` and `handleChatStream` so failed LLM calls no longer leak the agent's system prompt back to the client. Sensitive fields on AI SDK error classes (`requestBodyValues`, `responseBody`, `responseHeaders`, `data`, `prompt`) are stripped from the default serialization, including nested `cause` chains. Useful diagnostics (`name`, `message`, `url`, `statusCode`, `isRetryable`) are preserved.

`chatRoute` now also accepts an optional `onError` parameter so callers can opt into full diagnostics on a trusted surface:

```ts
chatRoute({
  agent: 'support-agent',
  onError: (error) => JSON.stringify(error), // full payload, including system prompt — own this risk
});
```
