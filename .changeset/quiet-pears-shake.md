---
'@mastra/factory': minor
---

Factory Overview now shows what landed in the repository, not only what moved on the board.

A **Latest commits** section reads the connected repository's default branch newest-first, on the same day-rail the Activity and attention pages use: the branch tip carries a ring, everything behind it a filled bead, and each row gives the subject, its author, the short sha and when it landed, opening the commit on GitHub. A Factory with no repository linked says so rather than sitting on a skeleton.

A Factory whose board was busy all day but whose main branch has not moved now says so on the page that is supposed to answer that question, instead of sending someone to GitHub to find out. The section leans on `GET /web/github/projects/:id/commits`, so it costs one rate-limited call per visit rather than a poll.
