---
'@mastra/server': patch
---

Fixed durable agent resume, approve, and decline routes returning 403 to the run's own caller when no auth middleware sets a server-side identity. Requests without an identity are now treated like workflow run ownership checks treat them, while requests with an identity are still checked against the run's resource and thread. Fixes #25511.
