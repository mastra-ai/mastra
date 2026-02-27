---
'mastracode': patch
---

Fixed a crash where ERR_STREAM_DESTROYED errors would fatally exit the process. These errors occur routinely during cancelled LLM streams, LSP shutdown, or killed subprocesses and are now silently ignored instead of crashing mastracode.
