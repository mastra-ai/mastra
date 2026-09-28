---
'@mastra/react': patch
---

Fixed the Approve and Decline buttons doing nothing for tool approvals from Inngest durable agents in Studio. These agents stream the approval without a preceding `start` event, so the chat hook never learned the run ID and silently dropped the approval. The hook now takes the run ID from the approval event itself.
