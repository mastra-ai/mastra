---
'@mastra/memory': patch
---

Fixed observational memory crashing when counting tokens for conversations that contain a failed tool call or an answered approval.

Persisted tool invocations can carry the `output-error` state (a tool that threw) or the `approval-responded` state (a resolved human-in-the-loop approval). The observational-memory token counter did not handle these states and threw `Unhandled tool-invocation state`, so recall on those conversations failed. Both states are now counted like the other tool states — `output-error` by its error text, `approval-responded` as control metadata with no tokens.
