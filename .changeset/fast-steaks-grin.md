---
'@mastra/code-sdk': patch
---

Fixed web search and web extract results that could end with half of an emoji or other character outside the Basic Multilingual Plane after truncation. Some providers reject such a request as invalid JSON, which ended the run. The broken half is now replaced with U+FFFD.
