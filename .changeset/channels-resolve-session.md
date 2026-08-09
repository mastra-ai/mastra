---
'@mastra/core': minor
---

Add `resolveSession` and `onStaleToolApproval` to agent controller channels.

`resolveSession` creates the session for a mapped channel thread in place of the built-in call. It runs before any session exists, so a host can refuse a request before a session, a model call, or any output happens, which is something `onSessionStart` cannot do, because it runs after the session is created and swallows errors. A refusal is silent: the chat thread gets nothing, so the host's authorization message never lands in a shared channel. Other failures still post an error to the thread as before, and a refusal is distinguishable as `ChannelSessionRejectedError` with the original error as its `cause`.

Approval actions now resolve their session with the action's own request context, so a shared install can revalidate the person answering an approval instead of trusting the request that opened the session.

`onStaleToolApproval` reports approval actions that have no matching parked gate, which is every approval answered after a restart. Mastra still refuses to run the tool; the hook lets a durable host settle that attempt rather than dropping the answer. It receives the `runId` the approval card was rendered for: the attempt the user answered, plus the session's `currentRunId`, which after a restart is usually null or a different run.
