---
'@mastra/editor': patch
---

Agent Builder is now more resilient to transient and provider-specific stream errors out of the box. The built-in builder agent ships with three error processors enabled by default — automatic retry of transient OpenAI errors (such as `server_error`, `rate_limit`, and `overloaded`), recovery from Anthropic 400 prefill rejections, and per-provider history-shape fixes — so flaky LLM calls no longer end the conversation. You can still pass your own `errorProcessors` to `createBuilderAgent` to extend or replace these defaults.
