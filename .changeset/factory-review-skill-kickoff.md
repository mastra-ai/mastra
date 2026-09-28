---
'@mastra/factory': patch
---

Fixed automated pull request reviews failing with "Skill not found: factory-review." when the review session was opened before its review role was assigned. The run now picks up the review skills at kickoff instead of retrying until it gives up.
