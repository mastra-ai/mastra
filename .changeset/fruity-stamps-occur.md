---
'@mastra/playground-ui': patch
---

Fixed the Traces page returning no traces, or the wrong traces, when a link or saved filter excluded a status or primitive type with "is not" (for example `?status=error&status.op=isNot`). These filters now show every trace except the excluded ones.
