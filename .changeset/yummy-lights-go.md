---
'@mastra/client-js': patch
'@mastra/factory': patch
---

Fixed transient provider failures looking like a dead run in the chat. A 503 the agent is already retrying now shows as one live line under the turn — `Service Unavailable · retrying 2/10` — that disappears as soon as output resumes, instead of stacking a red panel per attempt. A failure that really ends the run stays in the transcript, but as a compact inline row rather than a full-width notice.
