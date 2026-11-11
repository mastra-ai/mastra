---
'@mastra/server': patch
---

Forward HTTP-created feedback and scores to configured exporters after local persistence, preserving IDs, timestamps, authors and review status without writing the local record twice.
