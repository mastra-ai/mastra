---
'@mastra/core': minor
---

Added configurable error handling to model-backed guardrail processors. Existing configurations continue to warn and fail open when an internal model call fails:

```ts
new PromptInjectionDetector({
  model: 'openrouter/openai/gpt-oss-safeguard-20b',
});
```

Set `errorStrategy: 'strict'` to stop processing with a tripwire instead of allowing unchecked content:

```ts
new PromptInjectionDetector({
  model: 'openrouter/openai/gpt-oss-safeguard-20b',
  errorStrategy: 'strict',
});
```
