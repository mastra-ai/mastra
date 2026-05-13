---
'@mastra/react': patch
'@mastra/client-js': patch
---

Fixed `clientTools` being silently dropped — and never executed — on thread-backed chats. When a chat had a `threadId`, the React `useChat` hook routed messages through the new agent signals path but (a) did not forward the `clientTools` map to the server and (b) had no client-side execution loop on the subscribed thread stream, which broke client-side tools, human-in-the-loop approvals, and agent-builder client tools in Studio.

The signals path now forwards `clientTools` (running them through `processClientTools` before transport, matching the legacy stream route) and, when the subscribed stream finishes with `tool-calls`, executes the matching local client tool, patches the tool-invocation UI message to `state: 'result'`, and posts a continuation so the run resumes on the same thread.
