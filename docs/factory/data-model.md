# Data Model — Mastra Software Factory

All Factory tables live in the one `FactoryStorage` backend the host configures (Postgres or LibSQL). Every domain is org-first tenant-scoped (`org_id`), most are additionally project-scoped (`factory_project_id`). Source: `src/storage/domains/*/base.ts`.

## `factory_projects`

One row per Factory workspace. From `storage/domains/projects/base.ts`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `org_id` | text | tenant |
| `created_by` | text | |
| `name` | text | |
| `description` | text, nullable | |
| `default_model_id` | text, nullable | null = harness default |
| `slack_work_items_enabled` | boolean, default false | new Slack sessions create Work-board items |
| `auto_run_enabled` | boolean, default false | rules may start agent runs unattended |
| `auto_approve_plans` | boolean, default false | dispatcher answers `submit_plan` itself |
| `created_at`, `updated_at` | timestamp | |

Index: `factory_projects_org_updated_at_idx (org_id, updated_at)`.

## `work_items`

The card. From `storage/domains/work-items/base.ts`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `org_id`, `factory_project_id` | text | tenant/project scope |
| `board` | text, nullable | board id (`work`, `review`, or custom) |
| `external_source` | json, nullable | `{ integrationId, type, workspaceId?, externalId, url? }` |
| `source_key` | text, nullable | dedupe key from `external_source`; unique with project |
| `parent_work_item_id` | text, nullable | e.g. a PR item linked to its source issue |
| `title` | text | |
| `stages` | json | current `WorkItemStage[]` path |
| `stage_history` | json | append-only `{ stage, enteredAt, exitedAt?, by, exitedBy? }[]` |
| `sessions` | json | per-role bound `WorkItemSessionRef` (`sessionId`, `branch`, `threadId`, `startedBy`) |
| `metadata` | json, nullable | flags like `autoStartCandidate`, `factoryAuthored`, `authorTrusted` |
| `triage_type` | text, nullable | authoritative verdict from the bound triage run |
| `autonomy_armed_at` | timestamp, nullable | first human commit to running this item |
| `plans_preapproved_at` | timestamp, nullable | human granted hands-off plan approval, once |
| `accepted_at` | timestamp, nullable | first human move out of Intake/Triage |
| `comment_count` | integer, default 0 | denormalized, maintained by comments domain |
| `feed_activity_at` | timestamp, nullable | bumps on feed mutation |
| `revision` | integer, default 1 | optimistic concurrency token |
| `created_by`, `created_at`, `updated_at` | | |

Unique: `(factory_project_id, source_key)`. Indexes: `(org_id, factory_project_id, created_at, id)`, `(org_id, factory_project_id, parent_work_item_id)`, `(source_key)` (platform-message lookup by key alone).

## `factory_documents`

One row per `(org, project, catalog kind)` — every catalog kind present after a sync, a missing repo file stored as `status: 'missing'`. From `storage/domains/documents/base.ts`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `org_id`, `factory_project_id` | text | |
| `kind` | text | one of the 14 `FactoryDocKind` values |
| `path` | text | resolved path (manifest override or catalog default) |
| `title`, `summary` | text, nullable | derived at sync time |
| `content` | text, nullable | full body; null when missing/oversize |
| `content_hash` | text, nullable | |
| `size_bytes` | integer, nullable | |
| `status` | text | `present` \| `missing` \| `oversize` |
| `source_ref` | text | the ref the sync read from |
| `source_sha` | text, nullable | commit sha at sync time |
| `manifest_status` | text | `ok` \| `missing` \| `invalid` |
| `synced_at`, `created_at`, `updated_at` | timestamp | |

Unique: `(org_id, factory_project_id, kind)`, `(org_id, factory_project_id, path)`. Index: `(org_id, factory_project_id)`.

## `audit_events`

Append-only trail; no update/delete API. From `storage/domains/audit/base.ts`. Org-first, usually also project-scoped; `actor_id` records who acted but never scopes reads. Agent-driven rows use `actor_type = 'agent'`, `actor_id = 'agent:<threadId>'`, and `metadata.startedBy = <userId>` to chain accountability back to the human whose message started the run. v1 action taxonomy includes `factory.work_item.created/updated/stage_moved/deleted`, `factory.run.started`, `factory.worktree.created/deleted`, `factory.git.commit/push/pr_opened`, `factory.intake.config_updated`; v1.1 adds agent-level `factory.agent.commit/push/pr_opened`. Target is captured as `{ type, id, name? }` (WorkOS Audit Logs shape) for the optional export mirror.

## Rule-evaluation and dispatch tables (`storage/domains/work-items/base.ts`)

- **Rule ingress records** (`FactoryRuleIngressRecord`): `id, orgId, factoryProjectId, identity, triggerType, transitionId, result, createdAt` — one row per inbound event considered for rule evaluation, keyed for idempotency.
- **Rule evaluation records** (`FactoryRuleEvaluationRecord`): `id, ingressId, workItemId?, configVersion, expectedRevision?, outcome, code?, reason?, causalChain, createdAt` — the committed decision plus its causal chain, replayable by `ingressId`.
- **Deferred decisions / pending starts / run bindings** (`FactoryDeferredDecisionRecord`, `FactoryPendingStartRecord`, `FactoryRunBindingRecord`): dispatcher-owned state for parked approvals, queued run starts, and the live binding between a work item's role and its running agent session.
- **Dispatch status** (`FactoryDispatchStatus`): `pending | proposed | dismissed | superseded | leased | retry` — lifecycle of one dispatch attempt.

## Other domains (one storage class each, same tenancy pattern)

`intake` (selected sources/config per project), `comments` (`WorkItemCommentsStorage` — feed backing `comment_count`/`feed_activity_at`), `channel-identity` (chat-platform sender → tenant reverse index), `credentials` / `custom-providers` (model credentials, encrypted at rest via `secret-encryption.ts`), `filesystem` (session filesystem capture for audit), `memory-settings` (per-project observational-memory config), `model-packs`, `queue-health` (dispatcher health snapshots for the supervisor), `source-control` (per-integration source-control state, e.g. GitHub App installation/repo bindings), `integrations` (generic per-integration storage handle).

## Relationships

```
factory_projects 1───* work_items
work_items 1───* audit_events (via target)
work_items 0..1───1 parent work_items (parentWorkItemId, e.g. PR → source issue)
factory_projects 1───14 factory_documents (one row per catalog kind, always present after first sync)
work_items 1───* rule_ingress / rule_evaluation records (via causal chain + ingress identity)
```
