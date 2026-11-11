---
'@mastra/core': patch
'@mastra/server': patch
---

Listing a session's threads with `limit` now reads only the newest page from storage instead of every thread of the resource, and session recovery stops at the first matching thread. Resources with thousands of threads no longer load all of them for a 20-item sidebar.
