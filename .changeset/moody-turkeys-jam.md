---
'@mastra/server': minor
---

Added agent label management, storage capability reporting, and conditional Production activation using the existing read/publish permissions. Stale writes and attempts to delete labeled versions return structured errors, and automatic retention skips protected versions.

```http
PUT /stored/agents/agent-id/labels/candidate

{"versionId":"version-2","expectedRevisionToken":null}
```

```http
POST /stored/agents/agent-id/versions/version-2/activate

{"expectedActiveVersionId":"version-1"}
```

Agent reads and execution routes now accept strict version selectors, including tools, voice, networks, Responses, A2A, datasets, and AgentController. Continuations keep immutable root and dependency versions rather than re-resolving moved labels. Thread streams report trusted resolved version identity without exposing continuation tokens.

Supplying multiple selectors, such as `status` and `versionId`, returns `INVALID_VERSION_SELECTOR`. Custom labels require a supported agent storage adapter.

Production activation preconditions are serialized within one server process; they are not an atomic cross-process promotion lock.
