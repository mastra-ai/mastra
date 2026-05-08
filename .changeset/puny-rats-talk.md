---
'@mastra/core': patch
---

Fixed a bug where orphaned provider-executed tool calls (e.g. Anthropic `web_search`, Gemini `code_execution`) could brick a thread. When a provider dropped the tool-result chunk ([#15668](https://github.com/mastra-ai/mastra/issues/15668)) or a run aborted mid-stream ([#14148](https://github.com/mastra-ai/mastra/issues/14148)), the unresolved call was replayed on every subsequent request — causing Gemini to return empty text and Anthropic to reject the tool-call/tool-result invariant.

`sanitizeV5UIMessages` now only keeps an `input-available` provider-executed tool part on the most recent assistant message, and only when no user turn has followed it. Orphans on earlier assistant turns are dropped so the outgoing history always satisfies the tool-call/tool-result pairing required by provider APIs.
