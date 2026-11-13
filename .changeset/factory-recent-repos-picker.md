---
'@mastra/factory': patch
---

Fixed the repository picker failing with "Failed to list repos (500)" for GitHub accounts with hundreds of repositories. The picker now opens on the 8 most recently pushed repositories and searches GitHub by name once you start typing, instead of loading every repository up front. `/web/github/repos` accepts a `limit` and returns repositories most recently pushed first.
