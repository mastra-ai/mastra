---
'@mastra/factory': patch
---

Fixed replies from another linked Slack user using the responder's model credentials. Existing Factory Slack threads now keep using the session owner's provider credentials while preserving the responder's message attribution. Responders must belong to the session owner's organization, and subscribed follow-ups are rejected when the existing internal thread or owning session cannot be found.
