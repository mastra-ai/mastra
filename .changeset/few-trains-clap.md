---
'@mastra/mongodb': patch
---

Fixed MongoDB agents storage to persist and return the `visibility` and `starCount` fields on create, update, and list. Previously these fields were silently dropped, causing newly created agents to lose visibility settings and report no star count.
