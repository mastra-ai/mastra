---
'mastracode': patch
---

Fixed model selection being lost so the agent no longer prompts you to choose a model after you've already selected a models pack. The harness state schema was dropping the selected model id, leaving every pack (built-in or custom) with no active model.
