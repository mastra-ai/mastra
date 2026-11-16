---
'mastra': patch
---

Reduced provider requests from the Factory board and search. The board and ⌘K search now show only cards, read from Factory, and never ask GitHub, GitLab, Linear, Jira or incident.io for their issue or pull request lists. New issues and pull requests reach the board as cards the server files. An open issue or pull request with no card no longer appears in Intake or search until the server files it as a card.
