---
'@mastra/factory': patch
---

Fixed reopened pull requests showing as closed in Factory. Reopening a GitHub pull request now marks it open again on its card, both on a pull request's own card and on the issue card that links it. Subscribing a session again to a closed or merged pull request or GitLab merge request keeps its real state instead of marking it open.
