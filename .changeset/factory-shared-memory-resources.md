---
'@mastra/factory': minor
---

Factory sessions now share memory. A Factory's work-item runs, side sessions, and Slack channel threads store their threads under the Factory id. The sessions a person opens, and their Slack DMs, store theirs under that person's user id, so a DM is never shared with the Factory's runs. Factory sessions always use resource-scoped observational memory, and session state, `MASTRA_OM_SCOPE`, and `.mastracode/database.json` can't change that. Before, every session was its own memory resource, so resource-scoped memory never carried over from one run or chat to the next. Each session is still addressed by its own id, and each session's thread list still shows only its own threads.

Existing sessions move over when the server starts. Their threads, messages, run bindings, and pull request subscriptions move to the Factory or the owner, and each thread is tagged with its session id. The move is safe to repeat and deletes nothing. A session counts as the Factory's when it has a run binding, was started as a side session, or is a Slack channel thread; every other session, including pull request sessions opened before the upgrade, moves to its owner. Factory sessions with no Factory recorded are skipped and logged. Past observations stay findable in recall search under the new resource. Observational memory records written before the upgrade are not merged into the shared resource record, because several sessions now share one resource. The shared record starts empty, and resource-scoped records left under an old session key are logged.

Pull request and merge request subscription lookups now take a session id:

```bash
# Before
curl "$FACTORY_URL/web/github/subscriptions?resourceId=$SESSION_ID&threadId=$SESSION_ID"

# After
curl "$FACTORY_URL/web/github/subscriptions?sessionId=$SESSION_ID&threadId=$SESSION_ID"
```

The `resourceId` form still works.
