# @mastra/factory

The Mastra Software Factory module: the server core behind the Mastra Software Factory — an agent-powered software delivery environment built on [Mastra](https://mastra.ai).

Like `@mastra/code-sdk`, this package ships an unbundled ESM build that preserves the `src/` module structure, so every module is importable via the `@mastra/factory/*` wildcard export.

## Governed transition approvals

Factory rules can require supervisor approval for an agent-initiated stage transition with `requireSupervisorApproval`:

```ts
import { defaultFactoryRules, requireSupervisorApproval } from '@mastra/factory';

const rules = defaultFactoryRules({
  overrides: {
    work: {
      execute: {
        issue: {
          onEnter: context =>
            requireSupervisorApproval(context, {
              reason: 'Approve execution after reviewing the plan.',
              summary: 'Move this work item to execution',
            }),
        },
      },
    },
  },
});
```

The helper only creates approvals for transitions whose actor is an agent. Human transitions through the Factory HTTP API bypass the approval helper.

When approval is required, `factory_transition_work_item` returns `status: 'pending_approval'` immediately. It does not suspend the worker or require the worker to retry. The approval captures the item revision, destination stage, and validated rule effects. Approving it atomically moves the item and enqueues those effects only if the captured revision is still current. Rejecting it does not move the item. If the item changed first, resolution marks the approval `stale` without applying the transition.

Authenticated clients can list and resolve approvals through the tenant-scoped routes:

- `GET /web/factory/projects/:factoryProjectId/approvals?status=pending`
- `POST /web/factory/projects/:factoryProjectId/approvals/:approvalId/resolve` with `{ "decision": "approve" }` or `{ "decision": "reject" }`

Resolver and tenant identity always come from server authentication, not request-body fields.

## Supervisor state and lifecycle signals

Opening the canonical supervisor session emits a full `factory-state` snapshot. The snapshot is bounded to board and stage counts, at most 50 pending approvals with work-item title, role, requested stage, revision, reason, summary, and age, and live worker activity per active run binding — `running` (a run is in flight), `idle` (the bound session is live between runs), or `offline` (no in-process session owns the binding). It never includes credentials, storage handles, repository paths, or raw integration payloads. A stable cache key suppresses unchanged snapshots.

Approval requests and terminal approval results (`approved`, `rejected`, or `stale`) are written to a tenant-scoped durable outbox in the same transaction as the approval state change. The Factory dispatcher retries delivery to the singleton supervisor conversation and refreshes its state snapshot. Idle-without-transition notifications use the live observer described below and refresh the same state snapshot, but remain advisory rather than durable.

## Idle worker observation

Factory observes live work-item sessions for runs that finish normally without changing the item's stage or revision and without leaving a transition approval pending. The observer reconciles final persisted tool results before comparing state, records a bounded `factory.run.idle_without_transition` audit event, and provides the lifecycle callback used by the Factory supervisor.

Observation is enabled by default. A Factory can opt out through its rules configuration:

```ts
const rules = defaultFactoryRules({
  version: 'factory-rules-v1',
  overrides: {
    supervisor: { observeIdleWithoutTransition: false },
  },
});
```

This is an advisory live lifecycle signal, not durable Factory state. Each qualifying `agent_end` triggers it directly; there is no persisted completion cursor or polling deduplication, so a process crash at the completion boundary may lose the notification. Aborted, errored, suspended, transitioned, approval-pending, unbound, and opted-out runs do not emit it.

## Development (monorepo)

This package lives in the `mastra-ai/mastra` monorepo at `mastracode/factory`.

```bash
pnpm --filter ./mastracode/factory build   # transpile src -> dist + types
pnpm --filter ./mastracode/factory test    # vitest
pnpm --filter ./mastracode/factory check   # tsc --noEmit
```

## License

Apache-2.0
