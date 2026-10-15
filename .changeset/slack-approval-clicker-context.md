---
'@mastra/factory': patch
---

Fixed Slack tool approve/deny buttons failing with "Tenant model credential policy could not be resolved". A click now passes the same account-link check as a follow-up message: the clicker must be linked and in the session's organization, and the approved run resumes on the Factory session owner's model credentials. Unlinked clickers get the connect-account card, and clickers from another organization are refused, without resuming the run.
