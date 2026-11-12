---
'@mastra/factory': patch
---

Factory sessions and MCP clients can now read the Factory's audit trail with `factory_list_audit_events`: who did what to which work item, run, branch or setting, and when. Filter by actor (`me`, a user id, or an agent, optionally with the agent runs a person started), namespace or exact actions, work item and time range, and page back with a cursor. The tool only returns this Factory's events, never returns request context (IP address, user agent), email addresses or event metadata, and leaves out agent events from other people's private sessions.
