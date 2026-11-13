---
'@mastra/factory': patch
---

The Factory planning and building skills now say the plans directory is at the workspace root, never inside a repository checkout. An agent that wrote a plan to a repository-prefixed path such as `mastra/.artifacts/plans/issue-5.md` put it where the Factory UI never looks, which is how plan cards ended up unreadable.
