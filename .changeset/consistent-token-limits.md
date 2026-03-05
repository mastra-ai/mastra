---
'@mastra/core': patch
---

fix(workspace): Use consistent default token limit for `list_files` tool

The `list_files` tool was hardcoded to a 1,000-token output limit while all other workspace tools use `DEFAULT_MAX_OUTPUT_TOKENS` (2,000). Updated `list_files` to use the shared constant for consistency.

Also corrected the `maxOutputTokens` JSDoc comment which incorrectly stated the default was 3,000.
