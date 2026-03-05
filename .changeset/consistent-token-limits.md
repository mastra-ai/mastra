---
'@mastra/core': patch
---

fix(workspace): Use consistent default token limit for `list_files` tool

The `list_files` workspace tool now defaults to a 2,000-token output limit, matching all other workspace tools.
