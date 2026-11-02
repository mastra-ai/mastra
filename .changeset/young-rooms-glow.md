---
'@mastra/playground-ui': patch
---

Pagination in paged metrics tables, such as the Metrics Breakdown card, no longer jumps when a page has fewer rows. The table now reserves a full page of rows, so the last page, a single short page, or an empty result keep the same table height and Prev/Next stays where you clicked it. The Breakdown card shows 10 rows per page instead of 13.
