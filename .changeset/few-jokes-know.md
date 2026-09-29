---
'@mastra/factory': patch
---

Fixed Factory work sessions being able to load the review skills and approve their own pull requests. The factory-review, factory-rereview, factory-gitlab-review, and factory-gitlab-rereview skills are now only available to sessions running a Review phase ([#25228](https://github.com/mastra-ai/mastra/issues/25228)).
