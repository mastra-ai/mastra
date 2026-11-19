---
'@mastra/pg': patch
---

Fixed a Knowledge page move on Postgres leaving a page with its old scope and depth when that page was added under the moved subtree while the move was waiting for a lock. The move now locks the whole subtree and re-reads it until no page has been added, then updates exactly those pages.
