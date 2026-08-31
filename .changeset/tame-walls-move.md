---
'@mastra/server': minor
---

Added stored-agent version label management routes, storage capability reporting, version-list label badges, production activation preconditions, labeled-version deletion conflicts, and existing read/publish permission mapping. Agent execution and resolved-read routes now share strict selector validation across direct, legacy, network, tool, voice, Responses, A2A, dataset, and AgentController surfaces. Responses, completed A2A task follow-ups, cross-process approvals, recursive client-tool turns, and other continuations hydrate root and dependency selections from immutable pins and reject attempts to change a running version.

Supplying multiple query selectors such as `status` and `versionId` returns `INVALID_VERSION_SELECTOR` instead of applying precedence.

```http
PUT /stored/agents/agent-id/labels/candidate

{"versionId":"version-2","expectedRevisionToken":null}
```

```http
POST /stored/agents/agent-id/versions/version-2/activate

{"expectedActiveVersionId":"version-1"}
```
