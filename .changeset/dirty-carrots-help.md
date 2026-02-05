---
'@mastra/ai-sdk': patch
---

Fixed addToolOutput creating duplicate assistant messages by prioritizing the client's existing message ID during continuation flows (e.g. client-side tool results via sendAutomaticallyWhen)
