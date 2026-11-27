---
'@mastra/ai-sdk': patch
---

Fixed `chatRoute` returning a bare 500 when an agent with memory gets a thread but no resource ID. Both the regular and resumable chat routes now return the same 400 as the agent API: "A resource ID is required when using memory. Provide memory.resource in the request body, or configure server auth with mapUserToResourceId to derive it from the authenticated user." Requests without a thread, and agents without memory, behave as before. Resumable chat routes still take the resource ID only from authentication or route request context, never from the request body.
