---
'@mastra/factory': patch
---

Stop GitHub, GitLab, Linear, Jira and incident.io events from freezing the Factory server on large boards. Each event used to copy every card on the board, two or three times, to find the one it was about. Events, the issue and pull request sweeps, and board edits now read the board once and copy only the card they act on. On a 2,180-card board, 90 GitHub events went from 1.4 s to 0.06 s of blocked CPU.
