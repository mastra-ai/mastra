---
'@mastra/factory': patch
---

Added a file index for a session's workspace, so **Go to file** in the session panel finds any file in the repository by name, not only files in folders already opened. Files the repository ignores, nested repositories, and links that don't lead to a readable file in the workspace are left out. In a very large repository the list stops at a size limit, and in a multi-repository session a checkout that can't be read is skipped; either way the list says that it is partial.

Pull request subscriptions from GitHub and GitLab now include when each one last changed. The session panel uses it to show the most recent state of a pull request when the card and the subscription disagree.
