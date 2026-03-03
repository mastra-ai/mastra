---
'@mastra/convex': patch
---

fix: use existing indexes for queryTable operations instead of full table scans

The `queryTable` handler in the Convex storage mutation now automatically
selects the best matching index based on equality filters. Previously, all
`queryTable` operations performed a full table scan (up to 10,000 documents)
and filtered in JavaScript, which hit Convex's 16MB/32K document read limit
when enough records accumulated across threads.

Now, when equality filters are provided (e.g., `thread_id` for message queries
or `resourceId` for thread queries), the handler matches them against the
existing schema indexes (`by_thread`, `by_thread_created`, `by_resource`, etc.)
and uses `.withIndex()` for efficient indexed queries.
