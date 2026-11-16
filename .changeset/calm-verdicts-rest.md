---
'@mastra/factory': patch
---

Fixed pull request reviews that recorded the same verdict over and over without finishing. After a review session recorded its verdict, Factory told it a new review pass had started on the same commit, so it recorded the verdict again. The session is now told its pass is finished.
