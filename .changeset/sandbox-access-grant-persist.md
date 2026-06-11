---
'@mastra/core': patch
'mastracode': patch
---

Fix `request_access` granting a path but the file staying unreadable with `EACCES`. After approving access, the very next tool (e.g. `view`) could still be rejected for the path that was just granted. The grant now reliably applies to the filesystem the agent's tools actually read from, and persists before the run resumes, so reads of an approved path succeed.
