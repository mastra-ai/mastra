---
'@mastra/factory': patch
---

Factory no longer aborts the running agent, posts the stage notice, or sends a skill kickoff when the card leaves its phase while the work-item feed is loading. The decision now settles as superseded instead of succeeded. The same check runs after the stage notice is delivered.
