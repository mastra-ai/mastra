---
'@mastra/core': patch
---

Fixed the workspace `grep` tool cutting a long matching line in the middle of an emoji or other character outside the Basic Multilingual Plane. Some providers reject the resulting request as invalid JSON. The broken half is now replaced with U+FFFD.
