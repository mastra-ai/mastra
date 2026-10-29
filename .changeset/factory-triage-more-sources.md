---
'@mastra/factory': patch
---

Factory triage now handles Jira, incident.io, and GitLab cards. It reads each card with that source's own tool and posts its findings where it can. Jira issues get the pending summary and the triage handoff as comments. incident.io follow-ups and GitLab issues have no tool to write back to, so their handoff stays in the session. Triage and planning now also treat content from these sources as untrusted.
