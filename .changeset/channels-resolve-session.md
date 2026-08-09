---
'@mastra/core': minor
---

Add `resolveSession` and `onStaleToolApproval` to agent controller channels.

`resolveSession` creates the session for a mapped channel thread in place of the built-in call. It runs before any session exists and its errors propagate, so a host can refuse a request before a session, a model call, or any output happens — something `onSessionStart` cannot do, because it runs after the session is created and swallows errors.

Approval actions now resolve their session with the action's own request context, so a shared install can revalidate the person answering an approval instead of trusting the request that opened the session.

`onStaleToolApproval` reports approval actions that have no matching parked gate, which is every approval answered after a restart. Mastra still refuses to run the tool; the hook lets a durable host settle that attempt rather than dropping the answer.
