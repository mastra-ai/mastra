---
'@mastra/core': patch
'mastracode': patch
'@mastra/code-sdk': patch
---

Isolate tool approvals by thread and run: approval gates are now keyed by tool call and tagged with the thread and run that opened them, so concurrent runs cannot overwrite, strand, or answer each other's gates. Abort and user-message interjection release only the current thread's gates, and detached-thread approvals no longer fire notifications or permission hooks.