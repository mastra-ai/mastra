---
'@mastra/playground-ui': patch
---

Fixed the Traces page returning no traces, or the wrong traces, when a link or saved filter excluded a status or primitive type with "is not" (for example `?status=error&status.op=isNot`). On servers that support trace queries, these filters now hide only the excluded traces. Servers that only support the older trace list can't exclude values, so there the exclusion is ignored and traces matching your other filters are shown.
