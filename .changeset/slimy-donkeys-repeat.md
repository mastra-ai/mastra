---
'@mastra/code-sdk': patch
---

Fixed the cross-agent signal sender telling the model to resend a signal whose direct delivery failed. The notification dispatcher retries that delivery on its own, so the sender now reports that the signal waits in the recipient's inbox and is retried automatically, and that resending it would deliver a second copy.
