---
'@mastra/core': patch
---

Fixed subscribed thread streams so suspended tool resumes, same-run resumed streams, follow-up signals, and post-abort queued context are delivered through the authoritative subscription path without dropping or duplicating output.
