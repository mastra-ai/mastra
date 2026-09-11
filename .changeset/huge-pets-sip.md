---
'@mastra/core': patch
---

Fixed observational memory workflow resumes duplicating Anthropic thinking blocks when approved tools complete. Sealed assistant messages now update the existing tool invocation while preserving provider-signed reasoning.
