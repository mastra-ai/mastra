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

## Development (monorepo)

This package lives in the `mastra-ai/mastra` monorepo at `mastracode/factory`.

```bash
pnpm --filter ./mastracode/factory build   # transpile src -> dist + types
pnpm --filter ./mastracode/factory test    # vitest
pnpm --filter ./mastracode/factory check   # tsc --noEmit
```

## License

Apache-2.0
