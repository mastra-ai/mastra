---
'@mastra/factory': patch
---

Fixed the Jira issue detail endpoint so it only returns issues from the project named in the issue reference. Before, a hand-edited `issueRef` could point a bound project at an issue in an unbound Jira project and read its title, description and comments. An issue reference that names a different connection or project than its source is now rejected too.
