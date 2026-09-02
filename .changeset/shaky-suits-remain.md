---
'@mastra/core': patch
---

Fixed workspace skill discovery silently reporting zero skills when the workspace filesystem is mis-wired. Invalid-argument errors (Node `ERR_INVALID_ARG*`, e.g. a non-string path handed to the skill source) now surface from refresh() instead of being logged as an inaccessible skills path warning. Genuine access failures and network errors keep the warn-and-continue behavior. Closes https://github.com/mastra-ai/mastra/issues/22639
