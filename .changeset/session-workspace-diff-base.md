---
'@mastra/factory': patch
---

Fixed the session workspace Changes panel and file diffs going empty once a build session committed its work. Changes are now compared against the branch the session started from, so committed work stays visible.
