---
'@mastra/core': patch
---

Fixed a terminal provider error leaving an unresolved provider-executed tool call in the final message list. When a model stream ends with an error before a provider-executed tool (e.g. Anthropic web_search) returns its result, the abandoned tool call is now reconciled to an `output-error` state instead of remaining a dangling pending `call`. This preserves the original error, keeps successful tool results and surrounding text intact, and prevents observational memory from being deferred forever by an orphaned call.
