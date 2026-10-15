---
'@mastra/factory': patch
---

Fixed Slack tool approve/deny buttons failing with "Tenant model credential policy could not be resolved". A click now resolves the clicker's linked Factory account, the same way a message does, so the approved run resumes with that user's model credentials. Unlinked clickers get the connect-account card instead of resuming the run.
