---
'@mastra/factory': patch
---

Factories with more than ten repositories no longer hit GitHub's token rate limit when sessions start or environments build. Repository access is now requested ten repositories at a time and each token is reused for 20 minutes, so a Factory with eleven repositories needs two tokens instead of eleven.
