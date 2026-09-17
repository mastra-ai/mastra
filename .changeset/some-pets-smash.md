---
'@mastra/core': patch
---

Fixed requests failing with a 400 "Requests ending with a model turn are not supported" error on Gemini 3 models when the conversation ends with an assistant message. Fixes #23320.

- The trailing-message guard that Anthropic models already had under native structured output now also covers Google, Vertex AI, and gateway-routed Gemini 3+ models, for every request rather than only structured-output ones.
- The guard is attached whenever an agent has input processors, because a processor can switch the model mid-step. It checks the final model before running and is skipped entirely, with no processor span, when that model does not need it.
- The guard mirrors prompt conversion: assistant messages that end on a tool result are left alone, and history that ends on assistant text followed by an unfinished tool call is guarded correctly.
- The synthetic continuation turn is added as request-only context instead of being saved to the thread, so memory and chat UIs no longer show a "Continue." or "Generate the structured response." message the user never sent.
- `PrefillErrorHandler` also recognizes the Gemini error so the reactive retry path covers it too.
- Explicitly versioned Gemini 2.x models and Anthropic prefill behavior are unchanged. Unversioned Google ids such as `gemini-flash-latest` or `gemma-*` are guarded conservatively because they can resolve to a Gemini 3 model.
