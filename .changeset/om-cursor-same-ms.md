---
'@mastra/memory': patch
---

Fixed Observational Memory occasionally skipping a message that was created in the same millisecond as the observation cursor. Such a message could be pruned from the agent's context, left out of async buffering, or not counted toward the observation threshold, even though the observer never saw it. Messages already covered by an observation or buffered chunk are still excluded by id.
