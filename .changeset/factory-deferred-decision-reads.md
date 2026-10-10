---
'@mastra/factory': patch
---

Factory now reads far fewer rule decisions in the background. The health check only loads decisions still in flight, and the supervisor's card and failure views load only the decisions they show, instead of every decision the Factory ever made. Looking up the decisions behind a rule evaluation now uses an index rather than scanning the whole project.
