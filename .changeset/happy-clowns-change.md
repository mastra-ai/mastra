---
'@mastra/core': patch
---

Fixed null detection in tool input validation to check actual values at failing paths instead of relying on error message string matching. This ensures null values from LLMs are correctly handled even when validators produce error messages that don't contain the word "null" (e.g., "must be string"). Fixes #14476.
