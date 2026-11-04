---
'@mastra/code-sdk': patch
---

Fixed web search and web extract results that could contain a broken character after being shortened. Some providers rejected those requests, which ended the run. A character cut in half is now replaced with `�`.
