---
'mastra': patch
---

Fixed false-positive LOCAL_STORAGE_PATH preflight errors caused by code-example strings (e.g. Agent Builder prompts). The deploy preflight check now skips file: and localhost patterns that appear inside template/documentation strings containing markdown code fences.
