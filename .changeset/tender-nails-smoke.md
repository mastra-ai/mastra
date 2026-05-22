---
'@mastra/react': patch
'@mastra/client-js': patch
---

Fixed `clientTools` being silently dropped — and never executed — on thread-backed chats. When a chat had a `threadId`, the React `useChat` hook routed messages through the new agent signals path but did not pass the `clientTools` map into the signal subscription/idle-start flow, so client-side tools were unavailable when the model requested them.

The signals path now carries `clientTools` into the subscription and signal startup options. When the subscribed stream finishes with `tool-calls`, the client executes matching local tools with observability support, emits tool result chunks, and posts a continuation with the assistant tool-call messages plus tool-result messages so the run resumes on the same thread. React keeps the long-lived subscription in sync with the latest per-send request context, client tools, and continuation options before each signal is sent.
