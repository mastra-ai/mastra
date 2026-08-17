---
'@mastra/observability': patch
---

Fixed the `__truncated` marker on span data. It now counts only the fields dropped by the object-key limit, so traces no longer report more omitted keys than were really dropped. Values beyond the limit are no longer read.
