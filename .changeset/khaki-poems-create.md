---
'@mastra/core': patch
---

Fixed thread subscription generator blocking on post-finish stream data. After a terminal chunk (finish/error/abort), the generator now exits the inner read loop immediately and drains remaining stream data in the background, allowing subsequent runs to be served without waiting for post-processing (e.g. observational memory) to complete. Also ensures signals sent after a run finishes route through the idle path with fresh stream options.
