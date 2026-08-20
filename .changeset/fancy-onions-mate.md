---
'@mastra/factory': minor
---

Split the Factory overview's figures between the two boards it was averaging together.

The work board and the review board sat in one set of numbers. Reviewing a pull request takes minutes; building a card takes days — so a single median lands between the two answers and is neither. On one board here that read 0.3h, against 49.1h for the work the Factory actually did.

The funnel was worse. A pull request goes straight from filed to done, so 196 of 198 review threads were being credited with Triage, Planning and Building passes they never made — the shape people read to find where work stops was mostly threads that never entered the pipeline.

Every figure at the top of the page — picked up, shipped, lead time, agent coverage, rework, and the funnel — is now the work board alone. Review threads get their own row underneath: how many were reviewed in the window, how long filed → reviewed takes, and how many are still waiting on a review.

A pull request the Factory opened for one of its own cards counts on neither board. It is that card's output, so giving it a line of its own would report one delivery twice.
