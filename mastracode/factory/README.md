# @mastra/factory

`@mastra/factory` is the reusable backend for Mastra Software Factory. It owns Factory storage domains, routes, rules, integrations, sandboxes, and Factory-specific agent behavior.

Put React code in [`factory-ui`](../factory-ui/README.md), host wiring in [`web`](../web/README.md), and shared agent-controller behavior in [`sdk`](../sdk/README.md).

## Installation

```bash
npm install @mastra/factory
```

## Usage

Provide a configured `FactoryStorage` backend.

```typescript
import { MastraFactory } from '@mastra/factory';
import type { MastraFactoryConfig } from '@mastra/factory';

export function createFactory(storage: MastraFactoryConfig['storage']) {
  return new MastraFactory({ storage });
}
```

## Documentation

A host application calls `MastraFactory.prepare()`, constructs its `Mastra` instance, and then calls `MastraFactory.finalize()`. The `new Mastra(...)` expression must remain in the host entry file so Mastra's deployer can detect and bundle it. The implementation in `mastracode/web/src/mastra/index.ts` is the canonical host example.

`prepare()` initializes the Factory-owned resources needed before Mastra is constructed. `finalize()` connects those resources to the completed host, including Factory routes, integrations, storage-backed behavior, and agent-controller features. Consumers should keep frontend concerns in `factory-ui` and host-specific environment or deployment wiring in `web` rather than adding them to this package.

### Product telemetry

Factory records `factory_web_activity` in Mastra's existing PostHog project for users signed in through the default `mastra-studio` auth provider. The browser sends only a known page category and an activity type to the authenticated `/web/telemetry/activity` endpoint. The server adds the verified account and deployment context.

| Property                              | Meaning                                                                          |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| `activity`                            | `page_view` for a visible screen, or `interaction` for pointer/keyboard activity |
| `page`                                | A bounded category such as `work`, `review`, or `settings`; never a URL          |
| `platform_user_id`, `platform_org_id` | Opaque IDs from the authenticated platform account                               |
| `platform_project_id`                 | `MASTRA_PROJECT_ID`, when configured                                             |
| `platform_hosted`                     | Whether a nonempty `MASTRA_DEPLOYMENT_ID` is present                             |
| `deployment_id`, `platform_region`    | `MASTRA_DEPLOYMENT_ID` and `MASTRA_PLATFORM_REGION`, when configured             |
| `schema_version`                      | `1`                                                                              |

The person ID is `factory:platform:<user ID>`, consistent across local and hosted servers. This does not merge existing CLI or platform analytics profiles. A local server can have a platform project ID and use platform services while `platform_hosted` remains `false`. Non-platform hosting includes both local and other self-hosted servers; this event does not distinguish them.

Count unique people per day for visitors, and filter to `activity = interaction` for engaged users. Group by `platform_project_id` for project adoption. Interaction events are limited to once per minute per mounted browser app, and the server caps captures at 60 per minute per account/organization per process. Hidden tabs do not capture activity, and there is no background heartbeat. These are best-effort usage signals, not a record of successful product actions.

To disable collection, set this on the Factory Server:

```bash
MASTRA_TELEMETRY_DISABLED=true
```

`1`, `true`, and `yes` are accepted, ignoring case and surrounding whitespace. Older servers without the explicit capability do not receive browser telemetry requests. Custom auth providers are outside this initial measurement scope until they have a stable identity namespace. No names, emails, tokens, prompts, input values, raw URLs, session replay, or anonymous browser identity are collected by this event. Account IDs are identifiable account data, not anonymous data.

### Board lifecycle rules

Installed board definitions exclusively own phase entry and exit handlers. Work and Review are installed automatically with Mastra's preferred defaults; no rule configuration is needed. Custom boards declare source-specific `onEnter` and `onExit` handlers through `defineBoard()`:

```typescript
import { MastraFactory } from '@mastra/factory';
import type { MastraFactoryConfig } from '@mastra/factory';
import { defineBoard } from '@mastra/factory/boards';

const releaseBoard = defineBoard({
  id: 'release',
  title: 'Release',
  initialPhase: 'queued',
  phases: {
    queued: { title: 'Queued', kind: 'resting', next: 'shipped' },
    shipped: {
      title: 'Shipped',
      kind: 'terminal',
      onEnter: {
        manual: () => ({ type: 'reject', code: 'release_held', reason: 'Release is held.' }),
      },
    },
  },
});

export function createFactory(storage: MastraFactoryConfig['storage']) {
  return new MastraFactory({ storage, boards: [releaseBoard] });
}
```

Handlers return one typed decision or `undefined`. Supported sources are `issue`, `pullRequest`, `linearIssue`, and `manual`. Each Factory instance resolves handlers from its installed definitions. To install only custom boards, set `includeDefaultBoards: false`. The IDs `work` and `review` remain reserved; they cannot be used to replace the built-ins.

**Preferred intake behavior:** Work automatically invokes `factory-triage` only for linked-item materialization with `autoStartCandidate: true`. GitHub stamps that eligibility using actor trust and issue creation timing. Manual entry and noncandidate arrivals do not automatically start an investigation just because they enter Intake. Explicit issue triage remains available, and existing human-approval safeguards remain in effect. Linear intake does not automatically investigate; entering Triage invokes its existing investigation behavior. Review retains its guarded automatic first pass and explicit review behavior.

**Migration:** Remove former global `rules.work` and `rules.review` configuration. Built-in customization is deferred; there is no built-in override or replacement API. Define custom-board handlers on their phases instead. The web deployment now uses the guarded Work default rather than its former unconditional intake handler, so noncandidate or manual arrivals no longer start merely from entering Intake.

There is no global rules object. Every rule has one owner: boards own lifecycle handlers, transition policy, phase semantics, and tool-result rules; integrations own their event handlers. The runtime only executes rules.

### Board tool-result rules

A board may react to a tool result produced inside one of its seats. Declare handlers under `tools`, keyed by tool name:

```typescript
import { defineBoard } from '@mastra/factory/boards';
import type { BoardToolResultRuleHandler } from '@mastra/factory/boards';

const shipIt: BoardToolResultRuleHandler = context => {
  if (context.result.status !== 'success' || context.item.stages[0] !== 'queued') return;
  return { type: 'notify', idempotencyKey: `${context.ingress.id}:shipped`, title: 'Release shipped' };
};

const releaseBoard = defineBoard({
  id: 'release',
  title: 'Release',
  initialPhase: 'queued',
  phases: {
    queued: { title: 'Queued', kind: 'resting', next: 'shipped' },
    shipped: { title: 'Shipped', kind: 'terminal' },
  },
  tools: { ship_it: { onResult: shipIt } },
});
```

The handler receives the bound item, actor, board, tool name, normalized result, and `configVersion`, and returns one decision or `undefined`. Tool names follow the identifier rules for decision roles; `onResult` must be a function and the leaf may contain nothing else. Violations are `BoardDefinitionError`s at definition time.

Work declares one rule: `submit_plan`. When a `plan`-seated agent on a Planning card reports a result starting with `Plan approved.`, the card transitions to Execute. Review declares none. Resolution is fail-closed: a tool result on a card whose board is not installed, or whose board does not declare that tool, fires no rule — a custom board inherits nothing from Work even if it reuses Work's phase names.

### Config version

`configVersion` is an operator-maintained deployment label stamped onto transition audit rows, deferred decisions, reconciler audit, and the session kickoff header (`Config: …`). Nothing branches on it; it exists so an audit row can be traced back to the deployment that produced it. It defaults to `factory-config-v1` and must be a non-empty bounded string. The storage column keeps its shipped name, `rule_set_version`.

```typescript
new MastraFactory({ storage, configVersion: 'deployment-v2' });
```

**Migration:** The `rules` option, `FactoryRules`, `defaultFactoryRules`, and the `@mastra/factory/rules/defaults` subpath are gone. Passing `rules` throws at construction with a pointer to the replacements.

```typescript
// before
new MastraFactory({ storage, rules: defaultFactoryRules({ version: 'v2', overrides: { tools: { my_tool: { onResult } } } }) });
// after
new MastraFactory({ storage, configVersion: 'v2', boards: [defineBoard({ ..., tools: { my_tool: { onResult } } })] });
```

Contexts that carried `ruleSetVersion` now carry `configVersion`. Work's `submit_plan` rule cannot be replaced from config; built-in customization remains deferred.

### Board transition policy

Boards own three separate concerns: topology declares which moves exist, `transitionPolicy` restricts those moves, and lifecycle handlers return entry/exit effects. The transition service uses the policy on the item's persisted, installed board, with no fallback to Work policy.

Work automatically supplies its classification requirement, non-bug human-approval gate, and acceptance decision. Classified non-bug items without recorded acceptance require a human transition into Planning or Execute, regardless of their previous phase. Passing through Review does not grant approval. Historical items without an acceptance stamp also require this human transition; once acceptance is recorded, agents can continue the work. Review has no additional transition policy. Custom boards without a policy do not inherit Work's classification requirements or acceptance stamping, even if they use Work phase names or an agent role named `triage`.

```typescript
import { defineBoard } from '@mastra/factory/boards';
import type { BoardTransitionPolicy } from '@mastra/factory/boards';

const releasePolicy: BoardTransitionPolicy = context => {
  if (context.toStage === 'shipped' && !context.isHumanTransition) {
    return { type: 'reject', code: 'approval_required', reason: 'A person must approve this release.' };
  }
};

const releaseBoard = defineBoard({
  id: 'release',
  title: 'Release',
  initialPhase: 'approval',
  transitionPolicy: releasePolicy,
  phases: {
    approval: { title: 'Approval', kind: 'resting', next: 'shipped' },
    shipped: { title: 'Shipped', kind: 'working', role: 'release' },
  },
});
// Install through new MastraFactory({ storage, boards: [releaseBoard] }).
```

A policy receives a deeply readonly snapshot of the item and transition, including actor, ingress, source, revision, persisted classification and acceptance, requested classification, and initial-entry/reentry flags. Dates are ISO strings. `isHumanTransition` requires both a human actor and human ingress; a deferred rule with a human actor is not a human transition.

Return `undefined` for no additional restriction, `{ type: 'allow' }` with optional `triageType` and `accept: true` intents, or `{ type: 'reject', code, reason }`. Policies cannot return lifecycle effects or arbitrary patches. Classification intents must come from the existing triage-agent path and match its requested verdict; acceptance intents require a human transition. Runtime validates these intents and applies them only in the revision-checked transaction after all lifecycle handlers allow the move.

Policies must be side-effect-free. They run on initial entry, reentry, and same-stage requests, but completed replays use the stored result. Concurrent attempts can evaluate more than once. Policy and lifecycle evaluation share one timeout budget; a timeout does not cancel arbitrary work started by a callback.

A policy cannot bypass topology, ingress authorization, board ownership, external-author safety, revision checks, decision validation, replay handling, or atomic persistence. Returning `allow` is not an authorization override.

**Remaining limitations:** Built-in board replacement and customization remain unsupported.

### Board phase semantics

Every phase declares what it _is_ with a required `kind`; `defineBoard()` rejects a phase without one.

- `resting` — the card is parked. A human move out of a resting phase arms autonomy; a move back into one disarms it. `initialPhase` must be resting: a card cannot arrive already seated or already finished.
- `working` — an agent seat carries the card. `role` is required (same identifier rules as decision roles) and names the seat a human kickoff opens and the lane a rule-started run leaves rest for. Two working phases may share a role; `phaseForRole` returns the first in declaration order.
- `terminal` — the card is finished. Entering it releases the sandbox and lets sweeps supersede stale decisions and revoke run bindings. `role` is not allowed.

```typescript
const releaseBoard = defineBoard({
  id: 'release',
  title: 'Release',
  initialPhase: 'queued',
  phases: {
    queued: { title: 'Queued', kind: 'resting', next: 'shipping' },
    shipping: { title: 'Shipping', kind: 'working', role: 'release', next: 'shipped' },
    shipped: { title: 'Shipped', kind: 'terminal' },
  },
});
```

Work declares `intake` resting; `triage`, `planning`, `execute`, and `review` working with roles `triage`, `plan`, `work`, and `work`; `done` and `canceled` terminal. Review declares `intake` resting, `review` working with role `review`, and `done`/`canceled` terminal. The definition exposes the derived helpers `phaseKind`, `isWorking`, `isTerminal`, `roleForPhase`, and `phaseForRole`.

Consent, the external-author guard, kickoff seating, run-start lanes, terminal cleanup, the closed-PR and issue sweeps, and supervisor findings all read the installed board's declarations; nothing name-matches phases. A board that reuses Work's phase names gets exactly what it declared. Persisted `board` is authoritative; rows without one are read as Review for pull requests and Work otherwise.

Unknown semantics fail closed. When the board is not installed or the phase is not declared: external-event transitions ask for consent, no sweep or cleanup treats the card as finished, the supervisor neither revokes nor starts a seat for it, and a rule-started run from rest with no lane for its role is rejected.

**Migration:** Existing `defineBoard()` calls must add `kind` to every phase and `role` to working phases.

```typescript
// before
phases: { queued: { title: 'Queued', next: 'shipped' }, shipped: { title: 'Shipped' } }
// after
phases: {
  queued: { title: 'Queued', kind: 'resting', next: 'shipped' },
  shipped: { title: 'Shipped', kind: 'terminal' },
}
```

**Remaining limitations:** The `held-waiting` supervisor finding stays Work-specific. Throughput and lead-time metrics still count completions by Work's `done` phase. `factory-ui` still renders the built-in stage and role pipeline. Built-in board replacement and customization remain unsupported.

### Execute a custom board

Installed custom boards can create linked items, start working roles, transition through bound tools, and react to completed tool results. Board and phase identifiers contain 1–128 letters, digits, underscores, or hyphens and start with a letter or digit. Identifiers are case-sensitive and cannot contain surrounding whitespace.

This configuration runs a release rehearsal through `queued → preparing → shipping → shipped`. Add it to an existing Factory host with configured storage, a GitHub integration, a connected project repository, a sandbox, and organization-scoped model credentials. Enable automatic runs for the project. The repository must contain a `release:check` package script; it should validate the release without publishing it.

```typescript
import { MastraFactory } from '@mastra/factory';
import type { MastraFactoryConfig } from '@mastra/factory';
import { defineBoard } from '@mastra/factory/boards';
import type { BoardPhaseDefinition } from '@mastra/factory/boards';

type ReleasePhase = 'queued' | 'preparing' | 'shipping' | 'shipped';

const releaseBoard = defineBoard<'release', Record<ReleasePhase, BoardPhaseDefinition<ReleasePhase>>>({
  id: 'release',
  title: 'Release',
  initialPhase: 'queued',
  transitionPolicy: context => {
    if (context.fromStage === 'queued' && context.toStage === 'preparing' && !context.isHumanTransition) {
      return {
        type: 'reject',
        code: 'approval_required',
        reason: 'A person must start the release rehearsal.',
      };
    }
  },
  phases: {
    queued: { title: 'Queued', kind: 'resting', next: 'preparing' },
    preparing: {
      title: 'Preparing',
      kind: 'working',
      role: 'release-preparer',
      next: 'shipping',
      onEnter: {
        issue: context => ({
          type: 'invokeSkill',
          idempotencyKey: `${context.ingress.id}:prepare`,
          role: 'release-preparer',
          prompt:
            'Inspect the release changes. When ready, call factory_transition_work_item with stage shipping and the current expectedRevision from the Factory phase signal.',
        }),
      },
    },
    shipping: {
      title: 'Shipping',
      kind: 'working',
      role: 'release-publisher',
      next: 'shipped',
      onEnter: {
        issue: context => ({
          type: 'invokeSkill',
          idempotencyKey: `${context.ingress.id}:check`,
          role: 'release-publisher',
          prompt:
            'Run npm run release:check && printf "RELEASE_CHECK_PASSED\\n" with execute_command. This is a rehearsal; do not publish anything.',
        }),
      },
    },
    shipped: { title: 'Shipped', kind: 'terminal' },
  },
  tools: {
    execute_command: {
      onResult: context => {
        if (
          context.item.stages[0] !== 'shipping' ||
          context.result.status !== 'success' ||
          typeof context.result.value !== 'string' ||
          !context.result.value.trimEnd().endsWith('RELEASE_CHECK_PASSED')
        ) {
          return;
        }
        return {
          type: 'transition',
          idempotencyKey: `${context.ingress.id}:checked`,
          board: 'release',
          stage: 'shipped',
        };
      },
    },
  },
});

export function createFactory(config: Omit<MastraFactoryConfig, 'boards' | 'includeDefaultBoards'>) {
  return new MastraFactory({ ...config, boards: [releaseBoard], includeDefaultBoards: true });
}
```

Use the host's normal `prepare()`, `new Mastra(...)`, and `finalize()` sequence. Change the hardcoded `includeDefaultBoards: true` in `createFactory` to `false` to run without Work or Review. Working roles name bindings on the shared Code Agent; they do not register separate agents. Factory has no per-role agent configuration option. The board's kickoff prompts supply the role-specific instructions.

Create a card with `POST /web/factory/projects/:id/work-items`, passing `board: 'release'`, a title, and the GitHub issue's `externalSource`. The card starts in `queued`. Then use `POST /web/factory/projects/:id/work-items/:workItemId/transition` with `board: 'release'`, `stage: 'preparing'`, the returned `expectedRevision`, a unique `requestId`, and a `cause`. Send these requests as an authorized user using the host's authentication. The human transition satisfies this board's policy and starts the preparer. Its bound tool advances to `shipping`; the publisher's completed check produces a deferred transition to `shipped`. Terminal entry revokes the binding and releases the sandbox. The Factory UI performs the same operations against installed boards (see below); verify the persisted card's board, phase, and deferred decision status either way.

Lifecycle, tool-result, and integration handlers may return `upsertLinkedWorkItem` targeting a different installed board. Linked cards enter that board's declared initial phase before moving to the requested phase. Existing cards cannot be reassigned to another board through either decision type. Targets are validated against their own installed board before acceptance and again before uncommitted deferred effects execute; a phase declared only on another board is not valid. Committed replay retains its recorded result and original `configVersion`.

Custom phase signals and persisted tool-result ingestion use the item's installed board. Bound tools re-resolve the live binding, retain revision and topology checks, and reject session reassignment. A custom role named `triage` does not inherit Work's classification requirements. Existing authorization, external-author safeguards, and board-owned policies still apply.

### Custom boards in the Factory UI

`GET /web/factory/projects/:id/boards` returns the installed board catalog for an authorized project: each board's `id`, `title`, `initialPhase`, declaration-ordered `phases` (with `kind` and working `role`), and transition topology. Handlers, policies, and prompts are never serialized. The Factory UI reads this catalog instead of assuming Work and Review:

- Installed boards appear in the sidebar — built-ins first, then custom boards in registry order. Work and Review keep `/factories/:id/work` and `/factories/:id/review`; custom boards open at `/factories/:id/boards/:boardId`. An unknown board ID or a failed catalog request shows an explicit unavailable state rather than falling back to Work.
- Columns, phase labels, and working/terminal presentation come from the phase definitions. Card creation sends the selected `board`, so the server picks the initial phase. Card menus offer only moves the topology declares; the server still enforces policy, authorization, and revisions.
- A card's persisted `board` decides which board it belongs to. UI actions cannot move a card to a different board.
- Settings › Skills groups built-in skills under Work and Review and lists each custom board's declared roles. Custom-board kickoff instructions live in code; there is no skill or per-role agent configuration for them.
- Not yet board-aware: the Overview funnel and stage-hold metrics (Work-only), search scopes (Work/Review sessions), and the automation toggles that are specific to Work triage and Review. Custom-board cards still count toward in-flight totals and appear in activity and audit logs.

### Route intake to custom boards

Intake bindings are explicit. A Linear project (Settings › Intake › Linear routing) or GitHub repository is only offered as a candidate feed once it is bound to a board; nothing is materialized just by opening a board. Review only accepts pull requests and is not offered for issue routing.

- **Linear:** each project binding selects one installed board. Changing the board moves that source's existing cards to the new board's initial phase, skipping terminal cards and cards with an active session.
- **GitHub:** Settings › Intake › GitHub routing maps a label to a board per Factory project (`GET`/`PUT /web/intake/label-routes`). Labels match case-insensitively; unrouted issues go to Work. Saving a route relocates matching cards the same way, and `issues.labeled` / `issues.unlabeled` webhooks move a card between its routed board and Work while refreshing its label metadata. Routes apply to every repository linked to the project; label input is free text (no repository label autocomplete yet).

### Factory documents

A factory project keeps its essential documents as markdown in the repository under `docs/factory/`, mapped to a fixed catalog of kinds by `docs/factory/manifest.yaml`. The repository is the source of truth; the factory keeps a synced copy so the UI, agent kickoffs, and the read tool never need a checkout.

**Catalog.** Business: `product-vision`, `personas`, `user-stories`, `business-rules`, `glossary`, `process-flows`. Technical: `architecture`, `adrs`, `data-model`, `api-spec`, `coding-standards`, `testing-strategy`, `runbook`, `security-compliance`. Each kind has a default path (`docs/factory/<kind>.md`); the manifest overrides it:

```yaml
version: 1
documents:
  architecture: docs/factory/architecture/overview.md
  adrs: docs/factory/adrs/index.md
```

Paths must be markdown files under `docs/factory/`. Unknown kinds are ignored with a warning; a missing or invalid manifest falls back to the defaults and is reported as such.

**Sync.** Every time a session sandbox materializes the repository, the factory reads the manifest and every catalog kind with `git show origin/<default-branch>:<path>` and replaces the project snapshot in the `documents` domain (`factory_documents` table): title, first-paragraph summary, content hash, size, body (up to 256 KiB; larger files are indexed as `oversize`), and the commit it came from. Reads never touch the working tree, so a PR-sourced or session branch is never recorded as default-branch truth. The sync is best-effort and never fails a session start.

**Routes.** `GET /web/factory/projects/:id/documents` returns the catalog, one entry per synced kind (`present` / `missing` / `oversize`, no bodies), and the sync state. `GET /web/factory/projects/:id/documents/:kind` returns one document with its markdown body. `POST /web/factory/projects/:id/documents/refresh` fetches the default branch in a live session sandbox for a linked repository and re-syncs; it answers `409 no_active_sandbox` when no running sandbox holds the repository (the index then updates on the next run), `409 no_repository` when the project has no linked repository, and `503` when no sandbox is configured.

**Agents.** Every skill-invocation kickoff carries a `<factory-docs>` block after the work-item feed: one line per kind with path, title, and summary, labelled as data rather than instructions. Bound sessions get a `factory_read_document` tool that returns a document by kind or path from the synced copy. The bundled triage, plan, and review skills read the relevant documents and require code changes to update affected documents (and the manifest) in the same branch and pull request; documents are never a separate work item.

**UI.** Factory › Documents lists the catalog by group with each kind's status, renders the selected document as markdown (`?doc=<kind>` deep links), and offers Refresh. Missing kinds show the expected path and that agents create them alongside the code change that touches the area.

Not yet supported: editing documents in the UI, a per-factory docs folder or catalog, refresh without a live sandbox, and GitLab-linked repositories (sync runs through the GitHub sandbox path).

### GitHub event rules

Both `GithubIntegration` and `PlatformGithubIntegration` own their GitHub event handlers. Existing installations retain the defaults without additional configuration.

```typescript
import { PlatformGithubIntegration } from '@mastra/factory/integrations/platform/github/integration';

const github = new PlatformGithubIntegration({
  rules: {
    issueOpened: context => ({
      type: 'reject',
      code: 'manual_intake',
      reason: 'This deployment manages issue intake manually.',
    }),
    issueCommentCreated: null,
  },
});
```

Pass the integration in `MastraFactory`'s `integrations` array. The direct `GithubIntegration` accepts the same `rules` option alongside its GitHub App credentials. A function replaces one default handler without composing with it. `null` disables that event's handler, not authentication, webhook ingestion, or reconciliation bookkeeping. Omitted events and `undefined` retain their defaults. Each instance copies and freezes its resolved handler map; unknown event names and invalid handler values are rejected during construction.

**Migration:** Move each global `rules.github[event].onEvent` value to the integration constructor's `rules[event]` option:

```typescript
// Before: global Factory rule overrides
const overrides = { github: { issueCommentCreated: { onEvent: null } } };

// After: GitHub integration constructor options
const github = new PlatformGithubIntegration({ rules: { issueCommentCreated: null } });
```

Board definitions own lifecycle, transition-policy, phase-semantics, and tool-result rules; nothing is configured globally. `MastraFactory({ configVersion })` supplies the deployment-owned label stamped on audit records and GitHub evaluations; it is not a hash of custom handler code, not ingress identity, and does not change delivery replay semantics. Update `configVersion` when changing handler behavior.

Handlers receive the existing typed GitHub context and return one decision or `undefined`. External titles, bodies, and comments remain untrusted data after webhook authentication. Custom handlers must preserve any required actor-permission checks explicitly.

### incident.io intake

Use `IncidentioIntegration` with an incident.io API key to intake active incidents and outstanding follow-ups:

```typescript
import { IncidentioIntegration } from '@mastra/factory/integrations/incidentio/integration';

const incidentio = new IncidentioIntegration(); // Reads INCIDENT_IO_API_KEY.
const factory = new MastraFactory({ storage, integrations: [incidentio] });
```

For a Mastra Platform connection, use `PlatformIncidentioIntegration`. It proxies provider requests through `/v2/connections/{connectionId}/proxy` and reads `MASTRA_INCIDENT_IO_CONNECTION_ID` unless `connectionId` is passed to the constructor. `MastraFactory` installs it automatically when Platform credentials and that connection ID are present; an explicit integration with id `incidentio` takes precedence.

```typescript
import { PlatformIncidentioIntegration } from '@mastra/factory/integrations/platform/incidentio/integration';

const incidentio = new PlatformIncidentioIntegration({ connectionId: 'connection-id' });
```

Both integrations expose incidents and incident follow-ups as separate Intake sources. Their provider-neutral Intake items can be imported onto any installed board, including custom boards. A reconciliation worker polls imported incidents and follow-ups every five minutes by default to refresh their provider state and metadata. Set `MASTRACODE_INCIDENT_IO_RECONCILE_ENABLED=false` to disable it or `MASTRACODE_INCIDENT_IO_RECONCILE_INTERVAL_MS` to a positive millisecond interval to change its cadence. Follow-up state updates map Factory completion and cancellation to incident.io's `completed` and `not_doing` statuses. incident.io does not expose Intake comments through these adapters.

### Linear event rules

Both `LinearIntegration` and `PlatformLinearIntegration` automatically install the built-in `issueObserved` and `issueClosed` handlers. No default-rule imports or configuration are needed, including for `new PlatformLinearIntegration()` or direct construction with credentials only.

```typescript
import { PlatformLinearIntegration } from '@mastra/factory/integrations/platform/linear/integration';

const linear = new PlatformLinearIntegration({
  rules: {
    issueObserved: context => ({
      type: 'reject',
      code: 'manual_intake',
      reason: 'This deployment manages issue intake manually.',
    }),
    issueClosed: null,
  },
});
```

Install `linear` in `MastraFactory`'s `integrations` array. The direct `LinearIntegration` accepts the same `rules` option alongside `clientId` and `clientSecret`. A function replaces one default handler without composition; `null` disables that handler, not issue ingestion or reconciliation bookkeeping. Omitted events and `undefined` retain defaults. Both constructors validate event names and handler values, then copy and freeze an isolated resolved map.

**Migration:** Move global `rules.linear[event].onEvent` values into the owning integration constructor's `rules[event]` option:

```typescript
// Before: global Factory rule overrides
const overrides = { linear: { issueClosed: { onEvent: null } } };

// After: Linear integration constructor options
const linear = new PlatformLinearIntegration({ rules: { issueClosed: null } });
```

Linear event handlers are configured exclusively on the integration. Fetched issues, platform polling, and issue reconciliation use that instance's handlers. Defaults create intake items for observed open issues and close linked non-terminal Work items as Done or Canceled; closed unlinked issues do not create new items. Custom handlers receive the existing typed Linear context and return one decision or `undefined`. Treat issue titles, descriptions, and other external content as untrusted data.

`MastraFactory({ configVersion })` is the deployment-owned label stamped on Linear evaluations and audit records. Update it when handler behavior changes; it is neither ingress identity nor replay state.

### GitHub review commands

A repository maintainer with write or admin access can start a Factory review from a pull-request comment by posting the exact first-line command:

```text
@<factory-app> review
```

`@<factory-app> re-review` is also accepted. Factory resolves `<factory-app>` from its observed or configured GitHub App login (without the `[bot]` suffix), so commands are ignored until that identity is known. The command creates and starts a first Review pass for a missing or Intake card, restarts a completed card with `factory-rereview`, and is a no-op while the card is already Reviewing. Other prose, quoted mentions, edited comments, and comments from untrusted users do not trigger a run.

### Development

Run focused package checks from the repository root:

```bash
pnpm --filter ./mastracode/factory test
pnpm --filter ./mastracode/factory check
pnpm --filter ./mastracode/factory lint
pnpm --filter ./mastracode/factory build:lib
pnpm --filter ./mastracode/factory smoke:dist
```

Tests are colocated with source as `*.test.ts`. Use `smoke:dist` after building to verify that the published entry point can be imported successfully.

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/mastracode/factory/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
