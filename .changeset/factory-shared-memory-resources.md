---
'@mastra/factory': minor
---

Factory sessions now share memory. A Factory's work-item runs and Slack sessions store their threads under the Factory id, and the sessions a person opens store theirs under that person's user id. Before, every session was its own memory resource, so resource-scoped memory never carried over from one run or chat to the next. Each session is still addressed by its own id, and each session's thread list still shows only its own threads.

Existing sessions move over when the server starts. Their threads, messages, run bindings, and pull request subscriptions move to the Factory or the owner, and each thread is tagged with its session id. The move is safe to repeat and deletes nothing. A session counts as the Factory's when it has a run binding or a Slack branch; every other session, including pull request sessions opened before the upgrade, moves to its owner. Factory sessions with no Factory recorded are skipped and logged. Resource-scoped memory written before the upgrade stays under the old session key and is no longer read. Thread-scoped observational memory, the Factory default, moves with its thread.

Pull request and merge request subscription lookups now take a session id:

```bash
# Before
curl "$FACTORY_URL/web/github/subscriptions?resourceId=$SESSION_ID&threadId=$SESSION_ID"

# After
curl "$FACTORY_URL/web/github/subscriptions?sessionId=$SESSION_ID&threadId=$SESSION_ID"
```

The `resourceId` form still works.
