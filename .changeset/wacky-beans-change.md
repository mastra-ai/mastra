---
'@mastra/factory': minor
---

Added a way to take over a teammate's shared session. Anyone steering someone else's shared session sees a **Take ownership** button on the line under the composer. It asks for confirmation first, then stops a running agent and hands the session over: their next message runs with their credentials, and the thread shows a "Damien took ownership" divider that the agent also reads.

```http
POST /web/user-sessions/:sessionId/owner
{ "expectedOwnerId": "user-ward" }
```

`expectedOwnerId` is the owner the caller last saw. The response is `{ session }` with the new owner. The request returns `409` when someone else took the session first, when the caller already has a session on that branch, or for a Slack thread, Factory run or side session, which keep their owner, and `404` for a session the caller can't open. Each transfer is recorded in the Factory audit log as `factory.session.owner_transferred`.
