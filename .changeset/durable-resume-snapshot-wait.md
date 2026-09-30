---
'@mastra/server': patch
---

Fixed durable agent resume and tool approval routes returning 403 ("belongs to a different resource" or "tool call is not suspended") when the client resumes immediately after receiving a tool approval event. The access check now waits briefly for the suspended run to be saved before denying the request.
