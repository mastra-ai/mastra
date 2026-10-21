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

Handlers return one typed decision or `undefined`. Supported sources are `issue`, `pullRequest`, `linearIssue`, and `manual`. Each Factory instance resolves handlers from its installed definitions. To replace Work or Review, disable both default boards and install a board with the same ID. You can reinstall the exported `workBoard` and `reviewBoard` definitions unchanged, or use their phases as the starting point for a customized definition:

```typescript
import { MastraFactory, workBoard } from '@mastra/factory';

const factory = new MastraFactory({
  storage,
  includeDefaultBoards: false,
  boards: [workBoard],
});
```

Board IDs must be unique among the installed boards, so a same-ID board still throws while the defaults are enabled. Cards stored before board tracking resolve to `work` or `review`, and some runtime and UI behavior is keyed to those IDs, including Work issue intake and triage, the review-requested filter, and funnel metrics. Keep the built-in phase names and roles in a replacement unless you intend to change that behavior.

**Preferred intake behavior:** By default, every integration arrival lands in its routed board's initial phase—Intake for Work and Review—and does not start or suggest a run. This includes GitHub, GitLab, Linear, Jira, and incident.io; Linear, Jira, and incident.io no longer land directly in Triage. Only custom routes or explicit placement rules choose a different phase. Trusted maintainer requests to review a GitHub pull request with no existing card file it directly in Reviewing.

The `authorTrusted` and `autoStartCandidate` metadata stamps remain available for custom board rules. For example, a custom board can restore guarded arrival triage on its initial phase:

```typescript
const intakeRule = context =>
  context.cause === 'linked_item_materialized' && context.item.metadata?.autoStartCandidate === true
    ? {
        type: 'invokeSkill',
        idempotencyKey: `${context.ingress.id}:factory-triage`,
        role: 'triage',
        skillName: 'factory-triage',
      }
    : undefined;
```

**Migration:** Remove former global `rules.work` and `rules.review` configuration. Built-in customization is deferred; there is no built-in override or replacement API. Define custom-board handlers on their phases instead. Deployments that relied on automatic issue triage or review proposals on arrival should add an appropriate custom-board handler.

There is no global rules object. Every rule has one owner: boards own lifecycle handlers, transition policy, phase semantics, tool-result rules, and how their cards react to integration events; integrations own their default event handlers. The runtime only executes rules.

### Closing cards when their source closes

When a tracked GitHub, GitLab, Linear, or Jira issue or incident.io follow-up is closed, the stock integration rules move its card to a terminal phase of the board the card is on. The board declares which phases with `sourceClosed`: `completed` receives sources that were completed, and `canceled` receives sources that were canceled, not planned, or closed as duplicates. GitLab reports no close reason, so its closures always use `completed`. Both entries must name terminal phases.

```typescript
const releaseBoard = defineBoard({
  id: 'release',
  title: 'Release',
  initialPhase: 'queued',
  sourceClosed: { completed: 'shipped', canceled: 'dropped' },
  phases: {
    queued: { title: 'Queued', kind: 'resting', outcomes: { ship: 'shipped', drop: 'dropped' } },
    shipped: { title: 'Shipped', kind: 'terminal' },
    dropped: { title: 'Dropped', kind: 'terminal' },
  },
});
```

Work declares `{ completed: 'done', canceled: 'canceled' }`. A board without `sourceClosed` leaves its cards where they are, and cards already in a terminal phase are never moved. The move is an ordinary transition, so the board must allow it from the card's current phase. Integration rule overrides receive the same targets as `context.boardClosure`.

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

### Board event rules

A board can declare how its own cards react to GitHub, GitLab, Linear, Jira, and incident.io events. Declare handlers under `events`, keyed by integration and then by event name:

```ts
import { defineBoard } from '@mastra/factory';

const deliveryBoard = defineBoard({
  id: 'delivery',
  title: 'Delivery',
  initialPhase: 'triage',
  phases: {/* ... */},
  events: {
    github: {
      pullRequestMerged: context => ({
        type: 'sendMessage',
        idempotencyKey: `${context.ingress.id}:verify-merge`,
        role: 'work',
        message: `Pull request #${context.pullRequest?.number} merged. Verify the work is complete.`,
      }),
      pullRequestCommentCreated: null,
    },
    linear: {
      issueClosed: context =>
        context.issue.stateType === 'canceled' && context.phase?.outcomes.includes('canceled')
          ? {
              type: 'transition',
              idempotencyKey: `${context.ingress.id}:canceled`,
              board: 'delivery',
              stage: 'canceled',
            }
          : undefined,
    },
  },
});
```

A board handler runs only for events bound to a card on that board. Events without a card yet — issue intake and filing a pull request's own Review card — always use the integration's handlers.

For each event, Factory picks the handler in this order:

1. A handler the deployment set explicitly in the integration's `rules` (for example `new PlatformGithubIntegration({ rules })`). Existing integration-level handlers keep working unchanged.
2. The card's board handler. `null` switches the event off for cards on that board only; cards on other boards are unaffected.
3. The integration default.

A board handler that returns a decision replaces the default for that card. One that returns nothing lets the default run, so card-independent defaults such as dismissing stale Factory reviews still apply. The stock Work and Review behavior stays in the integration defaults and never acts on cards on other boards, so a custom board needs no board guards and no delegation to stock handlers.

Every integration rule context bound to a card carries `phase`: `{ id, kind, role?, outcomes }`, describing what the card's current phase means on its board. `outcomes` lists the outcome names the phase declares. `phase` is absent when the card sits in more than one stage or its board does not declare the phase.

Unknown integrations, unknown event names, and handler values other than a function or `null` are rejected by `defineBoard` with a `BoardDefinitionError`.

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

Consent, the external-author guard, kickoff seating, run-start lanes, terminal cleanup, and the closed-PR and issue sweeps all read the installed board's declarations; nothing name-matches phases. A board that reuses Work's phase names gets exactly what it declared. Persisted `board` is authoritative; rows without one are read as Review for pull requests and Work otherwise.

Unknown semantics fail closed. When the board is not installed or the phase is not declared: external-event transitions ask for consent, no sweep or cleanup treats the card as finished, and a rule-started run from rest with no lane for its role is rejected.

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

**Remaining limitations:** Throughput and lead-time metrics still count completions by Work's `done` phase. `factory-ui` still renders the built-in stage and role pipeline. Built-in board replacement and customization remain unsupported.

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

Intake bindings are explicit. A Linear project, Jira project, or GitHub repository is only offered as a candidate feed once it is bound to a board; nothing is materialized just by opening a board. Review only accepts pull requests and is not offered for issue routing.

- **Linear:** each project binding selects one installed board. Changing the board moves that source's existing cards to the new board's initial phase, skipping terminal cards and cards with an active session.
- **Jira:** each connected-site project binding selects one installed board. The create-Factory flow can select a Jira project and initially binds it to Work. The browser checks routed projects for new issues every 30 seconds and on window focus; issues observed for a routed project materialize automatically as work items on the bound board (mirroring Linear), and closed issues transition their linked card to done or canceled. Both `JiraIntegration` and `PlatformJiraIntegration` reconcile imported cards every five minutes by default so status and metadata continue to refresh without an open browser, and both accept a `rules` option to replace or disable the `issueObserved` / `issueClosed` defaults. Agents on Jira-sourced runs get `jira_get_issue` and `jira_create_comment`. Set `MASTRACODE_JIRA_RECONCILE_ENABLED=false` to disable reconciliation or `MASTRACODE_JIRA_RECONCILE_INTERVAL_MS` to a positive millisecond interval to change its cadence.
- **GitHub:** Settings › Intake › GitHub routing maps a label to a board per Factory project (`GET`/`PUT /web/intake/label-routes`). Labels match case-insensitively; unrouted issues go to Work. Saving a route relocates matching cards the same way, and `issues.labeled` / `issues.unlabeled` webhooks move a card between its routed board and Work while refreshing its label metadata. Routes apply to every repository linked to the project; label input is free text (no repository label autocomplete yet).

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

When Platform credentials are present, `MastraFactory` installs a `PlatformGithubIntegration` itself, so a deploy can change its handlers without constructing one. Pass the same options under `platform.github` and they are forwarded to that integration's constructor:

```typescript
import { MastraFactory } from '@mastra/factory';

// Your own label → board mapping (Settings › Intake › GitHub label routes remain
// the stored, per-project alternative when labels alone are enough).
const boardForLabels = (labels: string[]) => (labels.includes('design') ? 'design' : 'work');

new MastraFactory({
  storage,
  platform: {
    github: {
      rules: {
        // Route a new issue to the board its existing labels select, instead of
        // defaulting to Work.
        issueOpened: context => ({
          type: 'upsertLinkedWorkItem',
          idempotencyKey: `${context.ingress.id}:issue-intake`,
          board: boardForLabels(context.issue?.labels ?? []),
          source: 'github-issue',
          sourceKey: `github-issue:${context.issue!.number}`,
          title: context.issue!.title,
          url: context.issue!.url,
          stage: 'intake',
        }),
      },
      // Optional. Overrides the sibling `githubAppSlug` for recognizing Factory's own writes.
      slug: 'factory-app',
    },
  },
});
```

`platform.github` applies only to the integration the factory installs itself. An explicit `github` entry in `integrations` takes precedence and makes the key a no-op; the factory warns rather than ignoring it silently, and warns the same way when no Platform credentials and no explicit GitHub integration are present. `GithubRuleOverrides` (the `rules` option type) is exported from `@mastra/factory`.

**Migration:** Move each global `rules.github[event].onEvent` value to the integration constructor's `rules[event]` option:

```typescript
// Before: global Factory rule overrides
const overrides = { github: { issueCommentCreated: { onEvent: null } } };

// After: GitHub integration constructor options
const github = new PlatformGithubIntegration({ rules: { issueCommentCreated: null } });
```

Board definitions own lifecycle, transition-policy, phase-semantics, and tool-result rules; nothing is configured globally. `MastraFactory({ configVersion })` supplies the deployment-owned label stamped on audit records and GitHub evaluations; it is not a hash of custom handler code, not ingress identity, and does not change delivery replay semantics. Update `configVersion` when changing handler behavior.

Handlers receive the existing typed GitHub context and return one decision or `undefined`. External titles, bodies, and comments remain untrusted data after webhook authentication. Custom handlers must preserve any required actor-permission checks explicitly.

**Placement, not transition.** An `upsertLinkedWorkItem` decision normally names a destination: the card is materialized on the board's initial phase, the arrival rule runs, and a governed transition moves it to `stage` where that phase's entry rule runs. Set `skipRules: true` to file it on `stage` directly instead, as its first entry, with none of the board's phase rules run for it — no arrival, no destination entry, no transition row. The card is filed and left parked for a person:

```typescript
import { PlatformGithubIntegration } from '@mastra/factory/integrations/platform/github/integration';
import { defaultGithubRules } from '@mastra/factory/integrations/github/default-rules';

new PlatformGithubIntegration({
  rules: {
    // An issue whose triage is already recorded skips the triage phase
    // entirely and waits on Planning.
    issueOpened: context => {
      const decision = defaultGithubRules.issueOpened(context);
      if (!decision || !context.issue) return decision;
      const labels = context.issue.labels ?? [];
      if (labels.some(label => label.toLowerCase() === 'status: auto-triaged')) {
        return { ...decision, stage: 'planning', skipRules: true };
      }
      // A reconcile replay carries the existing card: a card that has already
      // left the landing phase is re-placed, not landed again.
      const moved = context.item !== undefined && !context.item.stages.includes(decision.stage);
      return moved ? { ...decision, stage: 'triage', skipRules: true } : decision;
    },
  },
});
```

Label-driven placement is a relocation, not a transition: `stage` must be a phase of `board`, and the card is written there in one step. An existing card the same decision reaches — a reconcile pass reacting to a label change, or a retry after a lost acknowledgement — is placed the same way, so the decision means the same thing whether the card is being created or already exists. The relocation guards apply: a terminal card, a card with a session attached to its current phase's role, and a card that changed under the dispatcher (revision conflict) all stay put. A retry whose materialization key already matches its card is a no-op, so a card that has since moved on is not dragged back to the stage this decision filed it at.

A decision _without_ the flag that reaches a card which already exists keeps the governed path, so once a card has left the board's initial phase the decision cannot move it: a destination transition starts at the initial phase, and the initial phase is deliberately never re-entered. A handler that answers for an existing card — the reconcile replay below — therefore sets `skipRules` itself when the labels, not an arrival, are what decides where the card belongs.

`AUTO_TRIAGED_LABEL` is exported from `@mastra/factory/rules/types` for the label the triage skill applies.

Reconciliation re-applies label-derived placement. The issue sweep replays an open issue through the rules ingress whenever the issue's live labels differ from the card's stored ones — the `labeled`/`unlabeled` webhook may never have arrived (Factory was down, or the label was applied by something else). The deployment rule decides placement, exactly as at arrival, and the context carries the existing card on `item`, so one handler answers for both: a card still resting on the board's initial phase is landed the normal way, and a card that has already left it is re-placed with `skipRules` and no phase rule run. Cards parked by hand are untouched while an issue's labels are unchanged.

A delivery that concerns two cards is evaluated once per card, each under its own ingress identity: every decision is committed against one card, at that card's revision. A merged pull request is the standard case — its Review card closes and the Work item that wrote the code assesses whether it is finished. An opening pull request is evaluated the same way. Its own Review card is filed by the arrival, the evaluation flagged `pullRequestIntake`, which is committed against the Work item that authored the pull request when provenance or a matching session branch names one; that binding is what links the new card to its item. The authoring item is then answered in a second evaluation of its own (`pullRequestIntake` unset), which is where a handler places the item that is now out for review. The built-in `pullRequestOpened` files the card only on the arrival and returns nothing for the authoring item.

### GitHub CLI authentication in Factory sessions

Factory offers `github_refresh_token` to sessions backed by an authorized GitHub repository, including Slack sessions that have no repository ID in controller state. The tool is visible before the sandbox starts, but it only works once the sandbox is running. Chat-only and GitLab-backed sessions do not get the tool.

If a sandbox `gh` command fails authentication, run `github_refresh_token` and retry the failed command. It reloads the organization's stored GitHub credential into that sandbox (or obtains repository access when no personal access token is configured); it does not rotate or renew an expired or revoked personal access token. Replace an invalid token in Factory's GitHub integration settings before retrying. The tool does not refresh GitLab credentials or return the GitHub token.

### GitLab intake and source control

Direct deployments can use either a GitLab Personal Access Token or Group Access Token. Both authenticate the GitLab API and Git-over-HTTPS in the same way; the difference is reach: a personal token follows the user's accessible projects, while a group token is limited to its group and subgroups. Configure the token with `api` and `write_repository` scopes so Factory can manage issues and merge requests, clone repositories, and push session branches.

```typescript
import { GitLabIntegration } from '@mastra/factory/integrations/gitlab/integration';

const gitlab = new GitLabIntegration({
  accessToken: process.env.GITLAB_ACCESS_TOKEN,
  accessTokenType: 'group', // Or 'personal'. Defaults to 'personal'.
  baseUrl: 'https://gitlab.example.com', // Omit for gitlab.com.
  webhookSecret: process.env.GITLAB_WEBHOOK_SECRET,
});
const factory = new MastraFactory({ storage, integrations: [gitlab] });
```

With no constructor options, the integration reads `GITLAB_ACCESS_TOKEN`, `GITLAB_ACCESS_TOKEN_TYPE` (`personal` or `group`), `GITLAB_BASE_URL`, and `GITLAB_WEBHOOK_SECRET`. See GitLab's [access-token scopes](https://docs.gitlab.com/security/tokens/access_token_scopes/), [personal token](https://docs.gitlab.com/user/profile/personal_access_tokens/), and [group token](https://docs.gitlab.com/user/group/settings/group_access_tokens/) documentation when creating the credential.

`GITLAB_BASE_URL` must use HTTPS. Plain HTTP is accepted only for loopback development instances (`localhost`, `127.0.0.0/8`, or `::1`), where the access token is sent without transport encryption.

For a Mastra Platform/Nango connection, use `PlatformGitLabIntegration`. `MastraFactory` installs it automatically whenever Platform credentials are configured and no integration with id `gitlab` was supplied. It discovers every active connection of the organization on the Platform's `gitlab` (OAuth) integration, proxies provider requests through `/v2/connections/{connectionId}/proxy`, and polls the Platform event log for GitLab events. `MASTRA_GITLAB_CONNECTION_ID` (or the `connectionId` constructor option) is optional and only narrows discovery to one connection. An explicit integration with id `gitlab` takes precedence.

```typescript
import { PlatformGitLabIntegration } from '@mastra/factory/integrations/platform/gitlab/integration';

const gitlab = new PlatformGitLabIntegration(); // Optionally { connectionId: 'connection-id' } to pin one connection.
```

In Platform mode, issue, note, merge request and push events reach Factory by polling the Platform's event log for each connection, the same way Platform GitHub deployments do. Point the GitLab project webhook at the Platform's Nango forwarding URL, not at Factory; Platform mode needs neither `MASTRA_GITLAB_CONNECTION_ID` nor `MASTRA_GITLAB_WEBHOOK_SECRET`. The direct `/web/gitlab/webhook` route stays available when `MASTRA_GITLAB_WEBHOOK_SECRET` is set; do not point a project webhook at both Factory and the Platform, or each event is processed twice.

| Variable | Default | Purpose |
| -------------------------------------------- | ------- |
| `MASTRA_PLATFORM_GITLAB_POLLING_ENABLED` | `true` | Set `false` to stop polling the Platform event log for GitLab events. |
| `MASTRA_PLATFORM_GITLAB_POLLING_INTERVAL_MS` | `20000` | Positive polling interval in milliseconds. |

These sit next to `MASTRA_PLATFORM_GITHUB_POLLING_ENABLED` and `MASTRA_PLATFORM_GITHUB_POLLING_INTERVAL_MS` and follow the same rules. One replica polls at a time; the cursor for each connection is stored in the integration settings table and only advances once a page of events has been processed. `diagnostics()` reports `pollingEnabled` and `pollingIntervalMs`.

### incident.io intake

Use `IncidentioIntegration` with an incident.io API key to intake active incidents and outstanding follow-ups:

```typescript
import { IncidentioIntegration } from '@mastra/factory/integrations/incidentio/integration';

const incidentio = new IncidentioIntegration(); // Reads INCIDENT_IO_API_KEY.
const factory = new MastraFactory({ storage, integrations: [incidentio] });
```

For Mastra Platform connections, use `PlatformIncidentioIntegration`. It discovers every active `incident-io` connection at runtime and proxies provider requests through `/v2/connections/{connectionId}/proxy`. `MastraFactory` installs it automatically when Platform credentials are present; an explicit integration with id `incidentio` takes precedence.

```typescript
import { PlatformIncidentioIntegration } from '@mastra/factory/integrations/platform/incidentio/integration';

const incidentio = new PlatformIncidentioIntegration(); // Reads Platform credentials from the environment.
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

### Factory tools in user sessions

A person's own Factory session (a user session) gets tools to find, file and manage the Factory's work items through its agent. Factory scopes the tools from the stored session row, never from the thread's `factoryProjectId` tag: the session must belong to a Factory in the caller's organization, and a private session only works for its owner. With authentication disabled, the shared `local` tenant applies. Sessions doing work for someone else, either bound to a work item's run or started as a side session, only get `factory_message_origin`, so they can report back and answer messages.

| Tool                            | Input                                                                                                                                           |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `factory_list_work_items`       | Optional `query` (title text or `#number`), `stage`, `board`, `role`, `active`, `requestedBy: 'me'`, `subscribed`, `limit` (default 25, max 50) |
| `factory_inspect_work_item`     | `workItem` (id or `#number`)                                                                                                                    |
| `factory_list_attention`        | Optional `limit` (max 50)                                                                                                                       |
| `factory_create_work_item`      | `title`, `brief`, optional `repository` (`owner/name`, one this Factory links)                                                                  |
| `factory_update_work_item`      | `workItem` plus any of `title`, `repository`, `parentWorkItem` (or `null` to detach), `plansPreapproved: true`                                  |
| `factory_subscribe_work_item`   | `workItem`                                                                                                                                      |
| `factory_unsubscribe_work_item` | `workItem`                                                                                                                                      |
| `factory_transition_work_item`  | `workItem`, `stage`                                                                                                                             |
| `factory_retry_decision`        | `decisionId`                                                                                                                                    |
| `factory_dismiss_decision`      | `decisionId`                                                                                                                                    |
| `factory_resolve_proposal`      | `decisionId`, `action` (`approve` or `dismiss`)                                                                                                 |
| `factory_start_session`         | `prompt` (up to 8000 characters), optional `title`, optional `model`; for a work-item role, `workItem` and `role`                               |
| `factory_answer_approval`       | `sessionId`, `toolCallId`, `decision` (approve or decline), optional `reason`                                                                   |
| `factory_switch_session_model`  | `sessionId`, `modelId`                                                                                                                          |
| `factory_signal_session`        | `sessionId`, `message` (up to 4000 characters), optional `priority` (`low`, `medium`, `high`, `urgent`; default `medium`)                       |
| `factory_message_origin`        | `message`, optional `inReplyTo` (the message's notification id), optional `status` (`progress`, `blocked`, `done`, `failed`)                    |

Read tools and `factory_message_origin` are available on every turn. The other tools only appear on turns a signed-in person started, so text arriving from a notification, webhook or channel can't drive them. The one exception is `factory_signal_session`: on those turns it can still message the side sessions this session started and the active sessions of work items it follows, so the session can answer the sessions it is waiting on. None of them asks for approval: they are allowed on the session when it's created, unless the person has set their own policy for the tool or for the `mcp` category.

`factory_switch_session_model` changes the model of a side, work item or review session you own in the same Factory, without recreating it. It refuses a model this server can't run. A running session switches right away; a stopped one uses the model on its next run.

`factory_create_work_item` files the card as the caller in its board's first phase, exactly like **New card**, posts the brief as its first comment, and subscribes the session. Name the `repository` when the Factory links more than one: a run can't start on a card that doesn't say which. `factory_update_work_item` sets it afterwards, like choosing a repository on the card, and also edits the title, the parent item and plan pre-approval. Both refuse a repository the Factory doesn't link, and a card synced from an issue keeps the issue's repository. Stages, the board and role sessions aren't fields it edits; stages move with `factory_transition_work_item`. Subscriptions are stored per work item and session in the `factory_work_item_subscriptions` collection and are removed with the item, so any number of sessions can follow one item.

#### Messaging between sessions

`factory_signal_session` messages any other session in the same Factory that the caller can see: a work item's role session, or a teammate's session that isn't private. The message arrives as a `factory-session` notification on that session's own thread. Factory brings an offline session back online first, and the turn it wakes runs as that session's owner, with the owner's credentials, never as the sender.

How a message is delivered depends on its priority. `urgent` always delivers, even into a running turn. `high` and `medium` wake an idle session; while it is busy, `high` arrives as a summary and then in full, and `medium` waits for the current step. `low` arrives as a summary. Agents can read the full text of any notification with `notification_inbox`. A session can have at most 10 messages, replies and reports, together, delivered to the same session thread in 10 minutes. Past that, the tools queue the message and say when it will be delivered, so the sender does not send it again; it goes out, oldest first, once the window has a slot. `progress` reports don't count, since they replace each other.

`factory_message_origin` with `inReplyTo` answers a message. `inReplyTo` must name a `factory-session` message that reached the answering session's own thread, and the reply goes to the session and thread that sent it, never to an address the agent supplies. Each message can be answered once, and replies, reports and other notifications can't be answered, so two agents can't ping-pong. Replies arrive at `high` priority and carry an `in-reply-to` attribute. Messages and replies are recorded in the audit trail as `factory.agent.signaled`.

#### Sub-sessions

`factory_start_session` starts another session for the caller and sends `prompt` as its first message. It has two modes:

- **Side session** (no `workItem`): a standalone session with no work item, for a one-off job. It uses the same repository as the session that started it. Factory stores that session on the new session's row (`origin_session_id`, `origin_thread_id`) and copies the parent's visibility. It runs on the model of the session that started it, or on `model` when one is passed. That model has to be one the session's credentials can run; an unknown or unrunnable model is refused before anything is created. When the parent has no model set, the side session keeps the Factory's default worker model.
- **Work-item role** (`workItem` and `role`): starts a role the item's board seats, the same way **Start** does in the Factory UI. The card does not move and no autonomy is armed. The tool refuses when the role already has a session, naming it so the agent can message it instead, and refuses an item linked to several repositories. The caller is subscribed to the item, and the run is recorded as `factory.run.started` with the caller as the person who started it.

Both modes attribute the new session to the caller, so it runs with the caller's credentials (the caller's own keys under the `user` model scope, the organization's under `factory`). A work-item role keeps the Factory's default worker model. The first message runs with only the caller as its user, never the rest of the parent turn's context. The tool needs no approval but, like the other management tools, only appears on turns a signed-in person started.

#### Reports

A spawned session reports back with `factory_message_origin` without `inReplyTo`. A side session's report goes to the session that started it; a work-item session's report goes to every session subscribed to the item except itself. The `status` sets how the report is delivered:

| `status`   | Notification kind | Priority |
| ---------- | ----------------- | -------- |
| `failed`   | `failed`          | `urgent` |
| `blocked`  | `blocked`         | `urgent` |
| `done`     | `done`            | `high`   |
| `progress` | `progress`        | `low`    |
| none       | `report`          | `high`   |

Progress reports from one session replace each other while unread. `done`, `failed` and `blocked` reports are never replaced, so a final report can't be overwritten by a later progress update.

Every run of a work session or side session ends with exactly one final report, however the run started: the board, a person typing into the session, a wake from another session's message, or a run after a server restart. Each Factory session gets a listener when it is created. A session with an active run binding reports to everyone following its work item, including for the run that moved the item to a finished stage and so ended its own binding; a side session reports to the session that started it; a person's own session reports to nobody. When a run ends, Factory checks each recipient's thread for a final report the agent sent since the run started, and sends one itself to the recipients that lack it: `done` when the run completed, `failed` when it ended in error (quoting the error), and `blocked`, naming the tool, when the run stopped waiting for an answer or for someone to approve a tool call. A reply with a final `status` counts as the final report, and any reply counts for a completed run. A run that completes after the agent reported `blocked` is waiting for an answer, so it gets no `done`; a run someone stopped gets no report. A board run that fails before it ever runs (no session, a configuration the run can't succeed with) reports `failed` once no retry remains. These backstop reports carry a `backstop` attribute.

A run that holds a tool call for approval stays open, so the same listener tells those sessions right away: an urgent `approval` notification names the session, the tool, its arguments and the `toolCallId`, once per call. A session that follows the work item, or started the side session, can answer it with `factory_answer_approval`, as the person signed in to it; the answer is audited as `factory.run.approved` or `factory.run.dismissed`. Other people's private sessions can't be answered, and an approval whose run already ended can't be either: the tool says so, and the session can be messaged to try again.

When a followed work item changes stage, subscribers whose session is running get a `low` priority `stage` notice. A stage change never wakes an offline session; it sees the current stage in its state signal instead.

#### The `<factory-sessions>` state signal

A user session sees what it is waiting on without calling a tool. Once it has started a side session or follows a work item, each step carries a `<factory-sessions>` state signal listing:

- side sessions it started: title, session id, whether it is running, parked or idle, and the last report with its time;
- work items it follows: number, title, stage, the session working on it and whether that session is `running`, `idle` or `parked`, and the last report with its time. Following doesn't end when an item finishes; a session can unsubscribe when it's done with an item.

Running entries come first, and the list shows at most 20 rows with a "+N more" line. Side sessions idle for more than 24 hours, and items in a finished stage for more than 24 hours, drop out. Sessions the caller only messaged never appear. When the last entry goes, the signal sends "No sub-sessions or followed work items." once and then stays silent. The signal is only resent when its content changes.

Spawned sessions get a one-line signal instead: a side session sees which session started it, and a work-item session sees the item, its role, and how many sessions follow it (nothing when nobody does).

The tools take their scope as an argument rather than reading the request, so the same tool set can later be mounted elsewhere, such as an MCP server.

### MCP server (ChatGPT and other MCP clients)

A Factory with an auth provider and an OAuth authorization server serves an MCP endpoint over Streamable HTTP:

```
https://<your-factory>/web/factory/projects/<projectId>/mcp
```

It exposes the Factory tools a signed-in web session has (list, inspect, create, update and transition work items, start and signal sessions, decisions, approvals), plus `search` and `fetch` over work items for ChatGPT. Each tool carries MCP annotations (read-only, destructive, idempotent) so clients can ask before changes.

Callers must sign in. Requests without a valid bearer token get `401` with a `WWW-Authenticate` header pointing to the RFC 9728 metadata at `/.well-known/oauth-protected-resource/web/factory/projects/<projectId>/mcp`. Tokens go through the same auth provider and org checks as the web UI. Each user gets one private connector session per Factory that the session tools act from.

To connect ChatGPT, open **Settings → Connectors → Create**, paste the endpoint URL, and choose OAuth. Factories on Mastra Platform auth advertise Platform's AuthKit (`https://auth-kit.mastra.ai`) automatically. With other auth providers, set the authorization server the metadata advertises, or the endpoint isn't served:

```ts
new MastraFactory({
  // ...
  mcp: { authorizationServers: ['https://your-tenant.authkit.app'] },
});
```

or set `MASTRA_FACTORY_MCP_AUTHORIZATION_SERVER`. Pass `mcp: false` to turn the endpoint off.

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
