---
'@mastra/factory': patch
---

Fixed the repository list the agent sees in a multi-repository Factory session. The list now always starts at 1 and continues without gaps, even when the project has repositories that are not part of the session's environment. Before, it could start at 2 or skip numbers.
