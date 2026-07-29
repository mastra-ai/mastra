---
'@mastra/factory': patch
---

Stop long-running Factory dispatches from starving the decision queue. The dispatcher poll loop previously awaited every dispatch to completion before claiming again, so a single slow effect (a skill kickoff consuming a full agent run, or binding preparation cloning a repository) froze the whole queue and left every other rule effect stuck in "pending" — sometimes for the 15-minute sandbox clone timeout times five retry attempts. Dispatches now run detached from the poll loop under a bounded in-flight cap while lease renewal keeps them protected from re-claim, so new decisions keep flowing while slow ones finish.
