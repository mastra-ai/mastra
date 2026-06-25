---
'mastracode': patch
---

Updated plan and explore modes to declare `availableTools` allowlists so tool visibility is gated at LLM-call time instead of workspace construction. Plan mode includes read-only tools plus plan-file editing and delivery tools; explore mode includes only read-only tools. Build mode remains unrestricted. Workspace creation no longer branches on mode for tool visibility — all modes now share the same workspace instance.
