---
'@mastra/pg': patch
---

Fixed a Knowledge page move on Postgres leaving a page with its old scope and depth when that page was added under the moved subtree while the move was waiting for a lock. The move now locks the live pages in the subtree and re-reads them until no page has been added, then updates those pages and the deleted pages under them. A move larger than the page limit is refused before any page in it is locked.
