---
'@mastra/factory': patch
---

Factory triage now handles Jira, incident.io, and GitLab cards. It reads each card with that source's own tool and posts its findings where it can. Jira issues get a short plain-text summary as a comment, without file paths or code, because the Jira audience may not have access to the repository. incident.io follow-ups and GitLab issues have no tool to write back to, so their handoff stays in the session. incident.io cards now pass the follow-up reference that the fetch tool needs. Triage and planning also treat content from these sources as untrusted.
