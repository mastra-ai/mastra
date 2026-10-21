---
'@mastra/factory': minor
---

Added a way to take over a teammate's shared session. Anyone steering someone else's shared session sees a **Take ownership** button on the line under the composer; after the transfer the session is theirs and their next message runs with their credentials.

```http
POST /web/user-sessions/:sessionId/owner
{ "expectedOwnerId": "user-ward" }
```

`expectedOwnerId` is the owner the caller last saw. The response is `{ session }` with the new owner. The request returns `409` when someone else took the session first, when the caller already has a session on that branch, while the session is still running, or for a Slack thread, Factory run or side session, which keep their owner, and `404` for a session the caller can't open. Each transfer is recorded in the Factory audit log as `factory.session.owner_transferred`.
