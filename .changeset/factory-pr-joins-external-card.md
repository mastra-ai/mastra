---
'@mastra/factory': patch
---

Fixed a pull request Factory opened for a card whose issue lives in Jira, Linear or incident.io getting a card of its own on GitHub. The pull request now attaches to that card and moves it to Review, as it already does on GitLab, so the work is no longer tracked on two cards while it is being reviewed. Fixes [#30358](https://github.com/mastra-ai/mastra/issues/30358).