---
'@mastra/connect': patch
---

Jira tool errors now include the human-readable message from `errorMessages[]` and field-level `errors` maps, and GitHub-style `{ message }` error bodies surface their message instead of a bare status code.
