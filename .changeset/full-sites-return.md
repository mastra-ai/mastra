---
'@mastra/core': patch
---

Fixed long `grep` result lines that could contain a broken character after being shortened. Some providers rejected those requests. A character cut in half is now replaced with `�`.
