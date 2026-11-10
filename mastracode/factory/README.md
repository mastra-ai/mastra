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

### Work items and board items

Factory stores provider facts separately from board activity:

- A **work item** stores provider-independent identity, title, and parent linkage in `factory_work_items`.
- A **source** stores provider identity, key, URL, state, labels, and author in `factory_work_item_sources`. A work item can have several sources; Factory-native work items have none.
- A **board item** tracks Factory's board, stages, sessions, revision, and process metadata in `factory_board_items`. Trust stamps such as `authorTrusted` and `factoryAuthored` stay here, not on the source.

Storage returns a `Card` that joins these records. Read sources from `card.workItem.sources`; read Factory process state from placement fields such as `card.acceptedAt`, `card.plansPreapprovedAt`, and `card.metadata`. A provider-only refresh updates the source's revision without changing the board item's revision, so it doesn't invalidate a pending stage move. Changes to any of these records invalidate the board list cache.

```typescript
import type { Card } from '@mastra/factory';

function summarizeCard(card: Card) {
  return {
    id: card.id,
    key: card.workItem.key,
    title: card.workItem.title,
    state: card.workItem.state,
    labels: card.workItem.labels,
    author: card.workItem.author,
    board: card.board,
    stages: card.stages,
  };
}
```

Each work item has one board item. Factory's card-to-card parent link is `parentBoardItemId`. Provider sub-issue ancestry is not populated into `card.workItem.parentWorkItemId`; migrated work items leave that field null. Existing card IDs, comments, subscriptions, run bindings, and `/work-items/:id` URLs stay unchanged. The work item gets its own ID. For one release, work-item API responses also retain the legacy top-level title, external source, and merged metadata fields.

#### Migration and dry run

Factory keeps the legacy `work_items` table and copies each card into the new tables. Before it starts serving, it copies only open cards. Done and canceled cards are copied in the background afterwards and appear on the board shortly after startup. While that runs, opening a card, or receiving a Linear, Jira, GitHub, GitLab, or incident.io event for it, copies that card on demand, so a reopened issue keeps its original card. Board lists, such as the Done column, fill in as the background copy progresses.

Once the background copy finishes, Factory records it, and later startups skip the copy. A card that an older Factory version changes in the legacy table afterwards is recopied at the next startup. Unchanged legacy rows are no-ops. Deleted board items have tombstones so a later startup doesn't resurrect them. A legacy row whose source conflicts with another card ID, or that was edited on both sides, is skipped rather than preventing startup; the copy still counts as finished.

Each copy pass logs one summary line with its counts and up to ten skipped card IDs with their reasons, for example `[factory] work item split (background pass): 9,837 cards checked, 0 copied, 106 recopied, 9,581 unchanged, 0 deferred, 150 skipped — <id> (Split board item changed after migration); … and 140 more`. A pass that runs longer than ten seconds also logs a progress line every ten seconds. When startup completes, Factory writes `[factory:timing] boot <n>ms` to stderr, regardless of the log level. Reconcile skipped card IDs before retiring the legacy data; comments and subscriptions linked to a skipped ID won't have a visible card until the conflict is resolved.

For a database that has not cut over yet, inspect the migration without switching storage by setting this environment variable before starting Factory:

```bash
MASTRA_FACTORY_WORK_ITEM_SPLIT=dry-run
```

Dry-run mode is only for pre-cutover databases. Once any split board items exist, startup fails in dry-run mode rather than serving stale legacy rows. Before cutover, dry-run mode logs the planned copies and keeps reads and writes on the legacy table. Remove the variable and restart to perform the migration and switch to the new tables. Normal operation doesn't write back to the legacy table, so rolling back to an older Factory version hides cards and changes created after cutover.

During mixed-version deployments, a changed legacy row is recopied only while its split records still match the migration baseline. Conflicting split-side edits are skipped and logged rather than overwritten. Legacy claim values remain inert and are not copied into split storage. Avoid simultaneous writes from old and new versions during the cutover.

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

### Work items, sources and board placements

Factory separates the work (`factory_work_items`) from external facts (`factory_work_item_sources`) and placement/process state (`factory_board_items`). A work item can have several sources; current intake still creates separate work items for an issue and its pull request. Native cards have no external source. Sources are deduplicated per organization, project, provider and external ID, not claimed across projects. Board placements do not acquire, adopt, look up or release claims.

The split migration preserves legacy card IDs for comments, subscriptions, runs and URLs. It never rewrites the legacy `work_items` table. Board placements store `triage_type`, `accepted_at`, `autonomy_armed_at` and `plans_preapproved_at`; the existing consent and plan-grant rules apply to them unchanged. The unused `claim_key` column stays only in legacy storage and is never copied into the new tables. A deterministic legacy fingerprint detects changes even when an older replica does not update `updated_at`; conflicting newer split-side changes are reported rather than overwritten.

Board placements store `comment_count`, maintained by the comments domain's recount after creates, edits and soft deletes. Card reads, transitions and session cleanup do not load comment rows. Recounts invalidate the board-list cache without changing the placement revision or `updated_at`. The migration copies the legacy count; its first recount can correct that baseline. `feed_activity_at` remains an internal stale-recount guard and is not returned on `Card`.

There is no dual-write rollback: an older Factory version sees the legacy snapshot, not cards created or changed after cutover. Operators must inspect migration reports for skipped IDs before retiring old replicas.

### Stored boards

Each project's boards live in its database, and the stored row is the board.

- **Factory's boards**: the built-in Work board and the boards you pass to `new MastraFactory({ boards })` (app boards). Factory stores each in a project once: when the project is created, and in existing projects the first time a process loads them, which includes the preload at startup. The project keeps a key's board from then on. A Factory release or an app change never rewrites it, and a board the project deleted is not stored again. A key you add later is stored once in every project that hasn't had it. The legacy Review board is never stored and stays read-only.
- **The project's own boards**: boards an admin created through the boards API, or that an app wrote with [`factory.upsertBoard()`](#writing-a-board-into-projects).

A project's boards are the Work and app boards in code order, followed by the others. The catalog, card creation through the API and Factory tools, transitions, the dispatcher, phase runs and the attention views all read that list. Existing apps need no change.

**Data model.** A stored board has a `key` (the ID cards reference as `board`), `name`, optional `description`, and ordered phases. A phase has a `key` (the stage ID), `name`, optional `description`, `kind`, and for working phases `runner` (`{ skill?, context?, instructions? }`), `autoStart`, `autoStartWhen` and `exitTool`, plus `nextPhases` on any phase. The first phase is the initial phase and must be `resting`. Saved boards pass the same checks `defineBoard()` applies, with the same messages. A board under a key no code board uses has no code behaviors: no handlers, transition policy, `sourceClosed`, or tool and event rules. Its working phases start their `runner` on entry.

`nextPhases` on a stored board: leaving it out (or `null`) on a resting or working phase allows moves to every other phase, `[]` allows none, and a terminal phase allows none unless it lists some.

**Editing the Work board and app boards.** The catalog and `GET …/boards/:boardKey` report each board's `source` (`builtin`, `app` or `stored`) and `editable` (`false` only for the legacy Review board). `PATCH` replaces the project's board. Factory serves the stored fields with the code behaviour of the board and of each phase key still attached: entry and exit handlers, outcomes, tool and event rules, `sourceClosed` and the transition policy. A runner's instructions reach the runs the code handlers start.

What code behaviour depends on stays fixed, and an edit that changes it is refused with `422 code_behaviour`, listing every conflict:

- Every phase the code declares stays, with the same `kind`, and the code's initial phase stays first.
- On a phase whose work runs in code handlers (Triage, Planning, Building, Review and PR review on Work), `runner.context` stays as declared and `runner.skill` stays unset: the handlers choose the skill.
- A declared exit tool (`submit_plan` on Planning) keeps its `id`. Its `autoApprove` and `autoApproveWhen` are yours. A phase whose code handlers move cards on without an exit tool can't get one: it would hold those moves back.
- Every move the code board allows from a phase stays in its `nextPhases`. Code makes those moves itself: an approved plan moves Planning to Building, a merged or closed pull request moves its card to Done or Canceled, and integration rules move cards between phases. You can add moves.

Everything else can change: names and descriptions, added `nextPhases`, `autoStart` and `autoStartWhen`, exit-tool approval, runner instructions, the runner of working phases without code handlers, the order of phases after the first, and new phases (which behave like stored-board phases).

**When Factory's definition changes.** A project keeps the board it stored, so a newer Work default or a changed app board doesn't reach it on its own. `POST …/boards/:boardKey/reset` with `expectedRevision` rewrites the board to Factory's current definition for its key (Work or an app board) at the next revision; revisions never go back, so a client holding an older revision is refused.

**Boards that no longer fit the code.** A Work or app board is served even when it has fallen out of step with a newer release's code, with the code behaviour that still fits it. A phase the code declares keeps its handlers only while it is on the board with the same `kind`, `runner.context`, `runner.skill` and exit tool; an outcome is dropped when its target phase is gone or the board no longer allows the move; the board's tool rules always stay (they hold exit-tool approvals, such as Planning's `submit_plan`), and its event rules and transition policy need every phase the code declares, and `sourceClosed` needs both its phases, still terminal. A move Factory's code makes that the board's `nextPhases` don't allow is reported too; when code makes it, the move is refused (and retried until its attempts run out), and the card stays where it is. Each dropped behaviour is reported in the board's `problems`, for example `Phase "testing" isn't on stored board "release", so its code behaviour doesn't run.` or `Phase "triage" runs without its code behaviour: <conflict>`. A board stored under an app board's key that the app stopped defining is served as one of the project's own boards.

Creating a board under a built-in or app board's key is refused with `409 code_board`, and so is deleting the Work board, whose code handlers run by its key; reset it instead. App boards can be deleted like the project's own; Factory doesn't store them again, and `factory.upsertBoard()` brings one back. A stored `review` board stays hidden by the Review board.

**When a board isn't stored.** If storing Factory's boards in a project fails, the boards it couldn't store aren't served, the catalog reports `Board "<key>" isn't stored in this project yet; Factory stores it on the next load.`, and `GET …/boards/:boardKey` answers `404 board_not_found`; the project's next load tries again. Factory serves code boards itself only for the legacy Review board, for every project when the boards storage could not start, and on a replica that has not loaded a project yet, until its first load.

#### Writing a board into projects

`factory.upsertBoard()` writes a board definition into projects after `prepare()`: each named project (or all of them) that has no board under its key gets it, and each one that has it, edited or not, has it replaced at the next revision. Factory doesn't run it for you, so projects created later don't get the board until you run it again; run it from an admin script, or after `prepare()` when you want every project to have the definition you ship. The board is checked once, as the boards API checks it, each replacement passes the checks an edit does (cards in a removed phase refuse it with `phase_in_use` there), and each write is audited as `factory.board.created` or `factory.board.updated` by `system:factory`. It returns the projects it stored the board in, the ones it replaced it in, and the ones that already had it unchanged. A refused board throws `BoardWriteError`, whose `code` is the boards API's error code (`invalid_board`, `unknown_skill`, `code_behaviour`, `phase_in_use`, `project_not_found`, or `code_board` for the legacy Review board's key). A board under a new key has no code behaviour; an app board's key keeps the app board's, so it also brings back an app board a project deleted.

```ts
const bugs = {
  key: 'bugs',
  name: 'Bugs',
  phases: [
    { key: 'reported', name: 'Reported', kind: 'resting', nextPhases: ['fixing'] },
    { key: 'fixing', name: 'Fixing', kind: 'working', runner: { context: 'work' }, nextPhases: ['fixed'] },
    { key: 'fixed', name: 'Fixed', kind: 'terminal' },
  ],
} satisfies StoredBoardInput;

const factory = new MastraFactory({ storage });
await factory.prepare();
const { inserted, updated, unchanged } = await factory.upsertBoard(bugs, { projects: 'all' });
```

**Editing rules for stored boards.**

- Board and phase keys never change. Renaming changes `name`. Any phase may become the first phase, as long as it is `resting`.
- Removing a phase, or changing its `kind`, while cards sit in it is refused with `409 phase_in_use` and the count per phase. Deleting a board that has cards is refused with `409 board_in_use`. Factory never moves cards for you. A card created between the check and the write can still land on a removed phase; it then shows as an unsupported item until it is moved.
- A runner skill that does not exist is refused (`422 unknown_skill`). A review skill outside the `review` context is saved with a warning in `problems`. A skill that disappears later never stops a board from loading; it shows in the catalog's `problems`.

**Replicas.** Each board write replaces the project's board version. The replica that wrote it sees the change at once; other replicas notice within a second, the next time they touch that project.

**Integrations.** Integration event rules and reconcilers read only the code boards, which edits can't break: the initial phase and every phase with code behaviour are kept. Integration messages use the code names of phases. Intake bindings and label routes can target only code boards. A project's [intake routes](#intake-routes) can also send new cards to its stored boards. Every card move goes through the transition service, which checks it against the project's boards.

**Routes.** All need project membership; changes need an organization admin when auth is enabled, and are recorded in the audit log as `factory.board.created`, `updated`, `deleted` and `reset`.

| Method   | Path                                                            | Body                                                    | Result                                                                                                                                                                                                                                         |
| -------- | --------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/web/factory/projects/:id/boards`                              | —                                                       | The catalog, with each board's `source`, `editable` and `problems`.                                                                                                                                                                            |
| `GET`    | `/web/factory/projects/:id/boards/:boardKey`                    | —                                                       | The definition, `revision` (`null` for the Review board), `source`, `editable`, `problems`, `codeBehaviour` (per phase: whether code handlers run it, its fixed exit tool and required next phases) and `canEdit` (whether you may change it). |
| `POST`   | `/web/factory/projects/:id/boards`                              | The board, with `key`.                                  | `201` and the board. `409 code_board` for a code board's key, `409 board_exists` for a stored board's.                                                                                                                                         |
| `PATCH`  | `/web/factory/projects/:id/boards/:boardKey`                    | The whole board without `key`, plus `expectedRevision`. | The board. Replaces every field. `422 code_behaviour` for an edit code behaviour can't honour, `409 code_board` for the Review board.                                                                                                          |
| `POST`   | `/web/factory/projects/:id/boards/:boardKey/reset`              | `{ expectedRevision }`                                  | The board, rewritten to Factory's current definition at the next revision. `409 not_code_board` for the project's own boards, `409 code_board` for the Review board.                                                                           |
| `DELETE` | `/web/factory/projects/:id/boards/:boardKey?expectedRevision=n` | —                                                       | `204`. `409 code_board` for the Work and Review boards.                                                                                                                                                                                        |

A stale `expectedRevision` is refused with `409 revision_mismatch`; reload the board and try again.

```bash
# Create a board.
curl -X POST "$FACTORY_URL/web/factory/projects/$PROJECT/boards" -H 'content-type: application/json' -d '{
  "key": "bugs",
  "name": "Bugs",
  "phases": [
    { "key": "reported", "name": "Reported", "kind": "resting" },
    { "key": "fixing", "name": "Fixing", "kind": "working", "runner": { "context": "work" } },
    { "key": "fixed", "name": "Fixed", "kind": "terminal" }
  ]
}'

# Rename its Fixing phase: read the board, change it, send it back with its revision.
curl "$FACTORY_URL/web/factory/projects/$PROJECT/boards/bugs" > bugs.json
jq '.board | { name, description, phases: (.phases | map(if .key == "fixing" then .name = "Patching" else . end)), expectedRevision: .revision }' bugs.json \
  | curl -X PATCH "$FACTORY_URL/web/factory/projects/$PROJECT/boards/bugs" -H 'content-type: application/json' -d @-

# Let Work's Planning start, and approve its plan, on its own for cards labelled effort:low.
curl "$FACTORY_URL/web/factory/projects/$PROJECT/boards/work" > work.json
jq '.board | { name, description, expectedRevision: .revision, phases: (.phases | map(if .key == "planning" then
  .autoStart = true
  | .autoStartWhen = { operator: "AND", conditions: [{ field: "item.labels", operator: "contains", value: "effort:low" }] }
  | .exitTool = { id: "submit_plan", autoApprove: true, autoApproveWhen: .autoStartWhen }
  else . end)) }' work.json \
  | curl -X PATCH "$FACTORY_URL/web/factory/projects/$PROJECT/boards/work" -H 'content-type: application/json' -d @-

# Put Work back to Factory's default.
curl -X POST "$FACTORY_URL/web/factory/projects/$PROJECT/boards/work/reset" -H 'content-type: application/json' \
  -d "{\"expectedRevision\": $(curl -s "$FACTORY_URL/web/factory/projects/$PROJECT/boards/work" | jq .board.revision)}"
```

Admins can make the same edits in the Factory UI under **Settings → Work board**.

### Migrating from `defineBoard()`

`defineBoard()` and the `boards` option of `MastraFactory` are deprecated: write board definitions into projects with [`factory.upsertBoard()`](#writing-a-board-into-projects), or manage them through the boards API. Nothing breaks: each project stores the boards you pass once, Factory serves them from its rows with the code behaviour the board declares, and a later code change reaches a project only through reset. Factory logs once per process:

```text
[Mastra Factory] MastraFactory({ boards }) and defineBoard() are deprecated: boards live in the database, and each project stores these definitions once. Write board definitions into projects with factory.upsertBoard(), or manage them through the boards API; see the README "Stored boards" section and mastra-ai/mastra#28920.
```

`includeDefaultBoards` decides whether projects get the built-in Work board (and the legacy Review board).

Using only the built-in boards logs nothing. A board that cards reach only through the API, the Factory UI or Factory tools, and that needs no handlers, policies or rules, can move off code: write its definition under a new key into projects with `factory.upsertBoard()`, move its cards, then stop passing the code board. Keep passing a board while integrations file cards onto it, intake bindings or label routes target it, or it needs code behaviors.

Removing `defineBoard()` still needs code behaviour that stored boards can reference by name, and integrations that read each project's boards. That work is tracked in [mastra-ai/mastra#28920](https://github.com/mastra-ai/mastra/issues/28920).

### Board lifecycle rules

Code boards own phase entry and exit handlers; stored boards have none, and a project's copy of a code board keeps its code's handlers (see [Stored boards](#stored-boards)). Work and Review are installed automatically with Mastra's preferred defaults; no rule configuration is needed. Custom boards declare source-specific `onEnter` and `onExit` handlers through `defineBoard()`, which is deprecated but still works:

```typescript
import { MastraFactory } from '@mastra/factory';
import type { MastraFactoryConfig } from '@mastra/factory';
import { defineBoard } from '@mastra/factory/boards';

const releaseBoard = defineBoard({
  id: 'release',
  name: 'Release',
  initialPhase: 'backlog',
  phases: {
    backlog: { name: 'Backlog', kind: 'resting', nextPhases: ['done'] },
    done: {
      name: 'Done',
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

Handlers return one typed decision or `undefined`. Supported sources are `issue`, `pullRequest`, `linearIssue`, and `manual`. Each Factory instance resolves handlers from its installed definitions. To replace Work or Review, disable both default boards and install a board with the same ID. Projects created after that store your board. Existing projects keep the Work board they already stored until an admin resets it or you write yours into them with `factory.upsertBoard()`. You can reinstall the exported `workBoard` and `reviewBoard` definitions unchanged, or use their phases as the starting point for a customized definition:

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

**Migration:** Remove former global `rules.work` and `rules.review` configuration. To customize Work or Review, set `includeDefaultBoards: false` and install a same-ID replacement, following the compatibility guidance above. Define lifecycle handlers on the replacement board's phases. Deployments that relied on automatic issue triage or review proposals on arrival should add an appropriate handler to the installed board.

There is no global rules object. Every rule has one owner: boards own lifecycle handlers, topology (`nextPhases`), phase semantics, tool-result rules, and how their cards react to integration events; integrations own their default event handlers. The runtime only executes rules.

### Closing cards when their source closes

When a tracked GitHub, GitLab, Linear, or Jira issue or incident.io follow-up is closed, the stock integration rules move its card to a terminal phase of the board the card is on. The board declares which phases with `sourceClosed`: `completed` receives sources that were completed, and `canceled` receives sources that were canceled, not planned, or closed as duplicates. GitLab reports no close reason, so its closures always use `completed`. Both entries must name terminal phases.

```typescript
const releaseBoard = defineBoard({
  id: 'release',
  name: 'Release',
  initialPhase: 'backlog',
  sourceClosed: { completed: 'done', canceled: 'dropped' },
  phases: {
    backlog: { name: 'Backlog', kind: 'resting', nextPhases: ['done', 'dropped'] },
    done: { name: 'Done', kind: 'terminal' },
    dropped: { name: 'Dropped', kind: 'terminal' },
  },
});
```

Work declares `{ completed: 'done', canceled: 'canceled' }`. A board without `sourceClosed` leaves its cards where they are, and cards already in a terminal phase are never moved. The move is an ordinary transition, so the board must allow it from the card's current phase. Integration rule overrides receive the same targets as `context.boardClosure`. When a project [intake route](#status-events-move-existing-cards) on the card's board handles `work_item.closed`, as the default close routes do on Work, the routes decide the move instead and `sourceClosed` is only the fallback.

### Board tool-result rules

A board may react to a tool result produced inside one of its seats. Declare handlers under `tools`, keyed by tool name:

```typescript
import { defineBoard } from '@mastra/factory/boards';
import type { BoardToolResultRuleHandler } from '@mastra/factory/boards';

const shipIt: BoardToolResultRuleHandler = context => {
  if (context.result.status !== 'success' || context.item.stages[0] !== 'backlog') return;
  return { type: 'notify', idempotencyKey: `${context.ingress.id}:shipped`, title: 'Release shipped' };
};

const releaseBoard = defineBoard({
  id: 'release',
  name: 'Release',
  initialPhase: 'backlog',
  phases: {
    backlog: { name: 'Backlog', kind: 'resting', nextPhases: ['done'] },
    done: { name: 'Done', kind: 'terminal' },
  },
  tools: { ship_it: { onResult: shipIt } },
});
```

The handler receives the bound item, actor, board, tool name, normalized result, and `configVersion`, and returns one decision or `undefined`. Tool names follow the identifier rules for decision roles; `onResult` must be a function and the leaf may contain nothing else. Violations are `BoardDefinitionError`s at definition time.

The default Work board declares two rules. `submit_plan`: in an interactive session, a successful result whose content starts with `Plan approved.` transitions a Planning card to Execute when the actor is the planning agent (`work`, or `plan` for cards planned before Planning moved to `work`). `factory_record_review_verdict` tells the builder to open the change request once self-review approves. Review declares none. Rules resolve from the installed board, so a replacement `work` board can declare its own `tools.submit_plan.onResult`. Resolution is fail-closed: a tool result on a card whose board is not installed, or whose board does not declare that tool, fires no rule. Other boards inherit nothing from Work even if they reuse its phase names.

### Board event rules

A board can declare how its own cards react to GitHub, GitLab, Linear, Jira, and incident.io events. Declare handlers under `events`, keyed by integration and then by event name:

```ts
import { defineBoard } from '@mastra/factory';

const deliveryBoard = defineBoard({
  id: 'delivery',
  name: 'Delivery',
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
        context.issue.stateType === 'canceled' && context.phase?.nextPhases.includes('canceled')
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

A board handler runs only for events bound to a card on that board. Events without a card yet — issue intake and filing a pull request's own card — always use the integration's handlers.

For each event, Factory picks the handler in this order:

1. A handler the deployment set explicitly in the integration's `rules` (for example `new PlatformGithubIntegration({ rules })`). Existing integration-level handlers keep working unchanged.
2. The card's board handler. `null` switches the event off for cards on that board only; cards on other boards are unaffected.
3. The integration default.

A board handler that returns a decision replaces the default for that card. One that returns nothing lets the default run, so card-independent defaults such as dismissing stale Factory reviews still apply. The stock Work and Review behavior stays in the integration defaults and never acts on cards on other boards, so a custom board needs no board guards and no delegation to stock handlers.

Every integration rule context bound to a card carries `phase`: `{ id, kind, context?, nextPhases, outcomes }`, describing what the card's current phase means on its board. `context` is the session context of a working phase (`role` carries the same value and is deprecated), `nextPhases` lists the phases the card may move to, and `outcomes` lists the outcome names the phase declares, if any. `phase` is absent when the card sits in more than one stage or its board does not declare the phase.

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

Contexts that carried `ruleSetVersion` now carry `configVersion`. To add a tool-result rule to Work, declare it under `tools` on the installed replacement `work` board.

### Where cards can move

Boards own two separate concerns: topology (`nextPhases`) declares which moves exist, and lifecycle handlers return entry/exit effects. `nextPhases` binds everyone: people dragging cards on the Factory board, agents calling `factory_transition_work_item`, and board rules. A move it does not list is rejected with `invalid_transition`. Staying in the same phase is always allowed.

The built-in Work board lists these moves:

| From      | To                                          | Why                                                                                                                                                                                    |
| --------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intake    | Triage, Planning, PR review, Done, Canceled | Never straight to Building or Review: a plan comes first, and Review is self-review of a build. PR review takes a pull request's own card; Done is where a completed source closes it. |
| Triage    | Intake, Planning, Done, Canceled            | A confirmed bug goes to Planning; any other open issue waits in Intake for a person.                                                                                                   |
| Planning  | Building, Intake, Done, Canceled            | Into Building only through the approved plan (see `exitTool` below).                                                                                                                   |
| Building  | Review, Planning, Done, Canceled            | Planning again when the build shows the plan was wrong.                                                                                                                                |
| Review    | Building, Intake, Done, Canceled            | Self-review of the build: only Building leads here. It sends the card back to Building, or parks it in Intake at its round limit; a parked card resumes through Planning.              |
| PR review | Intake, Done, Canceled                      | A pull request's own card: merged, closed, or set aside in Intake. It never reaches the builder's lanes.                                                                               |
| Done      | PR review                                   | A review request on a finished pull request reopens its review.                                                                                                                        |
| Canceled  | Intake, PR review                           | A canceled card is reopened in Intake; a reopened pull request goes back to PR review.                                                                                                 |

A pull request card only enters Intake, PR review, Done and Canceled, and only a pull request card enters PR review, for people too; Intake leads to both Triage and PR review and which one fits depends on the card, so this one rule stays in code (`workPullRequestCardRejection`). Planning ends with `submit_plan`, its exit tool: a plan waits for a person to approve it, and the approved plan moves the card to Building. Whether work is finished (no open pull request, no review asking for changes, an approving self-review) is not checked by the board: the build and self-review instructions tell the agent when to move a card to Done. Intake is resting, so nothing runs on a card parked there; an agent in another session could still move it.

The Review board's `done` follows the same topology. Its review instructions keep Done for the merge: a reviewer records its verdict and leaves the card in Reviewing, and the merge event moves it to Done.

**Triage.** The triage agent sends a confirmed bug to Planning, an open non-bug back to Intake, and closures to Done or Canceled. A person moving the card on from Intake is the approval; Factory records no classification or acceptance, and that move removes the `status: needs approval` label from the GitHub issue. On boot, Factory moves any card left in Triage by the old classify-and-accept rule back to Intake, once.

**Migration:** `transitionPolicy` on `defineBoard()` is deprecated. It still runs for boards that set it, and `defineBoard()` logs one warning per board. Its context no longer carries a requested classification, and `triageType` and `accept` on an `allow` are ignored. Express the flow with each phase's `nextPhases` and `exitTool` instead:

```typescript
// before
transitionPolicy: context => {
  if (context.fromStage === 'backlog' && context.toStage === 'done') {
    return { type: 'reject', code: 'invalid_transition', reason: 'Build before closing.' };
  }
},
// after, on the backlog phase
nextPhases: ['build'],
```

The built-in Work and Review boards no longer declare a transition policy, so `workBoard.transitionPolicy` and `reviewBoard.transitionPolicy` are `undefined`. A board that wraps either one and calls its policy (for example `context => workBoard.transitionPolicy!(context)`) throws `transitionPolicy is not a function` on every transition, recorded as a `rule_error`. Drop the delegating call; keep only your own checks, or move them to `nextPhases` and `exitTool`.

Rule contexts still carry `acceptedAt`, deprecated: it is the stamp on older cards and `null` for cards since.

### Board phase semantics

Every phase declares what it _is_ with a required `kind`; `defineBoard()` and the boards API reject a phase without one.

- `resting` — the card is parked. A human move out of a resting phase arms autonomy; a move back into one disarms it. `initialPhase` must be resting: a card cannot arrive already seated or already finished.
- `working` — an agent carries the card. `runner.context` (same identifier rules as decision roles, default `work`) names the session context a human kickoff opens and the lane a rule-started run leaves rest for. Two working phases may share a context, and then a session; `phaseForRole` returns the first in declaration order.
- `terminal` — the card is finished. Entering it releases the sandbox and lets sweeps supersede stale decisions and revoke run bindings. `runner` is not allowed.

```typescript
const releaseBoard = defineBoard({
  id: 'release',
  name: 'Release',
  initialPhase: 'backlog',
  phases: {
    backlog: { name: 'Backlog', kind: 'resting', nextPhases: ['build'] },
    build: { name: 'Build', kind: 'working', runner: { context: 'release' }, nextPhases: ['done'] },
    done: { name: 'Done', kind: 'terminal' },
  },
});
```

Work declares `intake` resting; `triage`, `planning`, `execute`, and `review` working with contexts `triage`, `work`, `work`, and `work`; `done` and `canceled` terminal. Review declares `intake` resting, `review` working with context `review`, and `done`/`canceled` terminal. The definition exposes the derived helpers `phaseKind`, `isWorking`, `isTerminal`, `roleForPhase`, and `phaseForRole`.

New pull requests and merge requests get their own card in Work Intake. The card's Review action moves it into Work's PR review phase (`pr-review`), where an independent reviewer runs `factory-review` (`factory-gitlab-review` for GitLab) in the card's own `review` session, or the re-review skill once a verdict is recorded. Work's Review phase is the builder's self-review of its own work, so a pull request card never enters it, and only pull request cards enter PR review. A pull request card only enters Intake, PR review, Done, and Canceled; merging moves it to Done and closing it unmerged to Canceled. Cards filed on the Review board before pull requests moved to Work stay there and keep working as before.

Planning and Building on Work share the `work` session, so the builder keeps the planner's reasoning, branch and sandbox. Self-review still runs in its own `review` session. When the planner moves the card to Building, the build prompt is queued onto its own run, and the planner's run binding ends at that point: Factory tools it calls later in the same turn are rejected. When the builder moves a card back from Building to Planning, no new planning run starts; the builder keeps working in its run. When a person moves it back, Planning starts again, in the same `work` session. The old `plan` role still names Planning: a run requested or queued for `plan` starts Planning in a `plan` session, and the build then continues in that session. Cards planned before this change do the same.

Consent, kickoff seating, run-start lanes, terminal cleanup, and the closed-PR and issue sweeps all read the project's board; nothing name-matches phases. A board that reuses Work's phase names gets exactly what it declared. Persisted `board` is authoritative; rows without one are read as Review for pull requests and Work otherwise.

Unknown semantics fail closed. When the board is not installed or the phase is not declared: external-event transitions ask for consent, no sweep or cleanup treats the card as finished, and a rule-started run from rest with no lane for its role is rejected.

**Migration:** Existing `defineBoard()` calls must add `kind` to every phase. Working phases name their session context with `runner.context`.

```typescript
// before
phases: { backlog: { title: 'Backlog', next: 'done' }, done: { title: 'Done' } }
// after
phases: {
  backlog: { name: 'Backlog', kind: 'resting', nextPhases: ['done'] },
  done: { name: 'Done', kind: 'terminal' },
}
```

**Remaining limitations:** Throughput and lead-time metrics still count completions by Work's `done` phase. `factory-ui` still renders the built-in stage and role pipeline.

### Phase runners, automatic starts and exit tools

Boards and phases take `name` and an optional `description`. A phase lists the phases a card may move to in `nextPhases`. A working phase can also declare:

- `runner` — `{ agentId?, skill?, context?, instructions? }`. `context` names the session the phase runs in (defaults to `work`); phases that share a context share a session. When the agent moves its own card into another phase of its context, that phase's `skill` still starts: its prompt is queued onto the agent's run. `skill` starts that skill when a card enters the phase from a source the phase has no `onEnter` handler for. It names a built-in Factory skill or one of your app's skills (see [Skills for custom boards](#skills-for-custom-boards)). `instructions` (up to 1,000 characters) are added to every run the phase starts. `agentId` defaults to `code-agent`, the only agent Factory runs today.
- `autoStart` and `autoStartWhen` — the phase's runs start without a person's approval, for every card or only for cards matching the rule. To start only trusted authors' cards, add `author.trusted equals true` to `autoStartWhen`; by default, [intake routes](#intake-routes) file GitHub and GitLab cards from outside the write-access circle in Work › Intake, where nothing starts on its own.
- `exitTool` — a tool name, or `{ id, autoApprove, autoApproveWhen }`, that ends the phase. The factory-phase signal tells the agent the phase ends when that tool succeeds and lists `nextPhases`; the agent then moves the card itself with `factory_transition_work_item`, so it picks where the card goes. When the board also has a tool rule for the exit tool (`tools`), the tool's success moves the card instead, and only a person can otherwise move it on to another working phase: an agent or board rule asking for that is rejected with `approval_required` unless the tool is auto-approved for the card. The phase needs at least one next phase. `autoApprove` answers the person's approval the tool waits for, for every card or only cards matching `autoApproveWhen`; it is the only way plans are approved without a person. Factory sessions already run tools without asking, so for `submit_plan` this means an auto-approved plan is accepted without a person. On other exit tools with a tool rule, `autoApprove` decides whether an agent may move the card on to another working phase without the tool. Work's Planning declares `{ id: 'submit_plan', autoApprove: false }`: every plan waits for a person, who moves the card or approves `submit_plan` in a signed-in chat.

Rules test a card's facts: `item.labels`, `item.title`, `item.author`, `author.trusted`, `source.kind` and `source.integration`.

The example below is a custom board, not Work's behavior: it auto-starts and auto-approves planning only for cards labelled `effort:low`.

```typescript
const LOW_EFFORT = {
  operator: 'AND',
  conditions: [{ field: 'item.labels', operator: 'contains', value: 'effort:low' }],
} as const;

const releaseBoard = defineBoard({
  id: 'release',
  name: 'Release',
  initialPhase: 'backlog',
  phases: {
    backlog: { name: 'Backlog', kind: 'resting', nextPhases: ['plan'] },
    plan: {
      name: 'Plan',
      kind: 'working',
      runner: { context: 'build', skill: 'factory-plan' },
      autoStart: true,
      autoStartWhen: LOW_EFFORT,
      exitTool: { id: 'submit_plan', autoApprove: true, autoApproveWhen: LOW_EFFORT },
      nextPhases: ['build', 'canceled'],
    },
    build: { name: 'Build', kind: 'working', runner: { context: 'build' }, nextPhases: ['done'] },
    done: { name: 'Done', kind: 'terminal' },
    canceled: { name: 'Canceled', kind: 'terminal' },
  },
});
```

**Migration:** `defineBoard()` still accepts the old field names and maps them to the new ones straight away: `title` → `name`, `role` → `runner.context`, `next` → `nextPhases`. It logs one warning per board that still uses them. Setting both `title` and `name`, or `role` and `runner.context`, to different values is rejected. `outcomes` is not deprecated: its targets are added to `nextPhases` and outcome names keep working. The board `defineBoard()` returns still has the old names as read-only copies — `board.title` and `phase.title` equal `name`, a working phase's `role` equals `runner.context`, and `phase.next` is set when the phase declared `next` — so code that reads them, or passes a defined board's phases to `defineBoard()` again, keeps working. They are deprecated; read `name`, `runner.context` and `nextPhases` instead. The board catalog (`GET /web/factory/projects/:id/boards`) still sends `title` and `role` beside the new fields for older clients. Card session keys do not change: a phase's context is its old role.

### Skills for custom boards

A phase's `runner.skill` runs a skill when a card enters the phase. Use a built-in skill such as `factory-plan`, or write your own. Factory finds a skill in this order; the first match wins:

1. **Code skills** — passed to `new MastraFactory({ skills })`, created with `createSkill()` from `@mastra/core/skills`.
2. **Folder skills** — `src/mastra/factory-skills/<name>/SKILL.md` in your app. `mastra build` copies the folder into the build output. The older `src/mastra/public/factory-skills` still works; when both exist, `src/mastra/factory-skills` wins. Factory also looks in `public/factory-skills`, `factory-skills` and `output/factory-skills` under the working directory, and uses the first that exists. Supporting files, such as `references/`, can sit next to `SKILL.md`.
3. **Built-in skills** shipped with `@mastra/factory`.

A skill with the same name as a built-in skill replaces it, for the built-in boards too. A code skill replaces the whole folder skill of the same name, including its supporting files. Repository skills in a project's own repository never replace these.

Skill names use 1–64 lowercase letters, digits and single hyphens, such as `release-notes`. A folder skill's `name` must match its directory name. Names in `skills` must be unique, or the constructor throws.

```typescript
import { createSkill } from '@mastra/core/skills';
import { MastraFactory } from '@mastra/factory';
import { defineBoard } from '@mastra/factory/boards';

const releaseNotes = createSkill({
  name: 'release-notes',
  description: 'Draft release notes for a work item',
  instructions: 'Group the release notes by package and end with a one-line summary. Then move the card to Published.',
});

const notesBoard = defineBoard({
  id: 'notes',
  name: 'Notes',
  initialPhase: 'backlog',
  phases: {
    backlog: { name: 'Backlog', kind: 'resting', nextPhases: ['drafting'] },
    drafting: {
      name: 'Drafting',
      kind: 'working',
      runner: { context: 'writer', skill: 'release-notes' },
      nextPhases: ['published'],
    },
    published: { name: 'Published', kind: 'terminal' },
  },
});

const factory = new MastraFactory({ ...config, boards: [notesBoard], skills: [releaseNotes] });
```

The same skill as a folder skill is `src/mastra/factory-skills/release-notes/SKILL.md`:

```markdown
---
name: release-notes
description: Draft release notes for a work item
---

Group the release notes by package and end with a one-line summary. Then move the card to Published.
```

The skill receives the card's link, or its title when it has none, as arguments. Every Factory session can also load your skills on request, like the built-in ones.

When a card enters the phase and the skill does not exist, no run starts and the card stays in the phase. The start fails with `Skill not found: <name>.`; after a few quick retries it stays failed, and you can retry it once the skill exists. The constructor logs a warning for each phase that names a missing skill. It also warns when a phase outside the `review` context runs a review skill (`factory-review`, `factory-rereview`, `factory-self-review`, `factory-gitlab-review`, `factory-gitlab-rereview`), because sessions only load those for reviews.

Settings › Skills shows the skill each custom phase runs, marks a phase whose skill is missing, marks built-in skills your app replaces, and lists your other skills under **App skills**.

### Edit skills for one Factory

Organization admins can change the instructions of any skill for one Factory, without redeploying. Open Settings › Skills, choose **Edit** on a skill, change its description or instructions, and save. This works for built-in, folder and code skills, including the review skills. Other members can open a skill but not change it.

An edit applies to that Factory only and takes precedence over the code, folder and built-in versions of the skill. Sessions that start after the save use it; running sessions keep the version they started with. A skill name cannot change, and the saved `SKILL.md` must pass the same checks Factory uses when it loads skills, or the save is rejected. Review skills stay limited to review sessions when edited.

An edited skill shows an **Edited** badge. When the original changes after the edit, for example in a new release of `@mastra/factory` or of your app, the editor says so; the edit stays in place until you choose **Revert to original**. If the original skill is removed from your app, its edit stops applying.

Saves and reverts are recorded in the audit log as `factory.skill.updated` and `factory.skill.reverted`. The API is `PUT` and `DELETE` on `/web/factory/projects/:id/skills/:name`, and `GET /web/factory/skills?projectId=<id>` lists a Factory's skills with its edits.

### Execute a custom board

Custom boards can create linked items, start working roles, transition through bound tools, and react to completed tool results. Board and phase identifiers contain 1–128 letters, digits, underscores, or hyphens and start with a letter or digit. Identifiers are case-sensitive and cannot contain surrounding whitespace.

This configuration runs a release rehearsal through `backlog → preparing → build → done`. Add it to an existing Factory host with configured storage, a GitHub integration, a connected project repository, a sandbox, and organization-scoped model credentials. Enable automatic runs for the project. The repository must contain a `release:check` package script; it should validate the release without publishing it.

```typescript
import { MastraFactory } from '@mastra/factory';
import type { MastraFactoryConfig } from '@mastra/factory';
import { defineBoard } from '@mastra/factory/boards';
import type { BoardPhaseDefinition } from '@mastra/factory/boards';

type ReleasePhase = 'backlog' | 'preparing' | 'build' | 'done';

const releaseBoard = defineBoard<'release', Record<ReleasePhase, BoardPhaseDefinition<ReleasePhase>>>({
  id: 'release',
  name: 'Release',
  initialPhase: 'backlog',
  phases: {
    backlog: { name: 'Backlog', kind: 'resting', nextPhases: ['preparing'] },
    preparing: {
      name: 'Preparing',
      kind: 'working',
      runner: { context: 'release-preparer' },
      nextPhases: ['build'],
      onEnter: {
        issue: context => ({
          type: 'invokeSkill',
          idempotencyKey: `${context.ingress.id}:prepare`,
          role: 'release-preparer',
          prompt:
            'Inspect the release changes. When ready, call factory_transition_work_item with stage build and the current expectedRevision from the Factory phase signal.',
        }),
      },
    },
    build: {
      name: 'Build',
      kind: 'working',
      runner: { context: 'release-publisher' },
      nextPhases: ['done'],
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
    done: { name: 'Done', kind: 'terminal' },
  },
  tools: {
    execute_command: {
      onResult: context => {
        if (
          context.item.stages[0] !== 'build' ||
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
          stage: 'done',
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

Create a card with `POST /web/factory/projects/:id/work-items`, passing `board: 'release'`, a title, and the GitHub issue's `externalSource`. The card starts in `backlog`. Then use `POST /web/factory/projects/:id/work-items/:workItemId/transition` with `board: 'release'`, `stage: 'preparing'`, the returned `expectedRevision`, a unique `requestId`, and a `cause`. Send these requests as an authorized user using the host's authentication. The move starts the preparer. Its bound tool advances to `build`; the publisher's completed check produces a deferred transition to `done`. Terminal entry revokes the binding and releases the sandbox. The Factory UI performs the same operations against installed boards (see below); verify the persisted card's board, phase, and deferred decision status either way.

Lifecycle, tool-result, and integration handlers may return `upsertLinkedWorkItem` targeting a different installed board. Linked cards enter that board's declared initial phase before moving to the requested phase. Existing cards cannot be reassigned to another board through either decision type. Targets are validated against their own installed board before acceptance and again before uncommitted deferred effects execute; a phase declared only on another board is not valid. Committed replay retains its recorded result and original `configVersion`.

Custom phase signals and persisted tool-result ingestion use the item's installed board. Bound tools re-resolve the live binding, retain revision and topology checks, and reject session reassignment. A custom role named `triage` does not inherit Work's classification requirements. Existing authorization, external-author safeguards, and board-owned policies still apply.

### Custom boards in the Factory UI

`GET /web/factory/projects/:id/boards` returns the project's boards (its code boards, then its stored boards) for an authorized user: each board's `id`, `title`, `initialPhase`, declaration-ordered `phases` (with `kind`, and for working phases `role` and the `skill` the runner starts), and transition topology. Handlers, policies, and prompts are never serialized. The Factory UI reads this catalog instead of assuming Work and Review:

- Installed boards appear in the sidebar — built-ins first, then custom boards in registry order. Work and Review keep `/factories/:id/work` and `/factories/:id/review`; custom boards open at `/factories/:id/boards/:boardId`. An unknown board ID or a failed catalog request shows an explicit unavailable state rather than falling back to Work.
- Columns, phase labels, and working/terminal presentation come from the phase definitions. Card creation sends the selected `board`, so the server picks the initial phase. Card menus offer only moves the topology declares; the server still enforces policy, authorization, and revisions.
- A card's persisted `board` decides which board it belongs to. UI actions cannot move a card to a different board.
- Settings › Skills groups built-in skills under Work and Review. For each custom board it shows the skill each phase runs (`runner.skill`) and the roles of phases that run no skill; those phases' kickoff instructions live in the board definition. Your app's other skills appear under App skills.
- Not yet board-aware: the Overview funnel and stage-hold metrics (Work-only), search scopes (Work/Review sessions), and the automation toggles that are specific to Work triage and Review. Custom-board cards still count toward in-flight totals and appear in activity and audit logs.

### Route intake to custom boards

Intake bindings are explicit. A Linear project, Jira project, or GitHub repository is only offered as a candidate feed once it is bound to a board; nothing is materialized just by opening a board. Review only accepts pull requests and is not offered for issue routing.

- **Linear:** each project binding selects one installed board. Changing the board moves that source's existing cards to the new board's initial phase, skipping terminal cards and cards with an active session.
- **Jira:** each connected-site project binding selects one installed board. One Jira project can feed several Factory projects: each binding takes either all issues or only issues carrying its labels (Settings › Intake › Jira routing, or `labels` on `PUT /web/intake/bindings`). Each label belongs to one binding per Jira project, and only one binding per project can take all issues. Label bindings win over the all-issues binding; an issue carrying labels of two label bindings goes to the binding created first. The split happens in the JQL each Factory sends, so every issue is filed in exactly one Factory. Labels only decide placement when an issue is first filed: relabelling an issue, or editing a binding's labels, does not move existing cards. Remove one Factory's binding with `DELETE /web/intake/bindings?integrationId=jira&sourceId=…&factoryProjectId=…`. The create-Factory flow can select a Jira project and initially binds it to Work. The browser checks routed projects for new issues every 30 seconds and on window focus; issues observed for a routed project materialize automatically as work items on the bound board (mirroring Linear), and closed issues transition their linked card to done or canceled. Both `JiraIntegration` and `PlatformJiraIntegration` reconcile imported cards every five minutes by default so status and metadata continue to refresh without an open browser, and both accept a `rules` option to replace or disable the `issueObserved` / `issueClosed` defaults. Agents on Jira-sourced runs get `jira_get_issue` and `jira_create_comment`. Set `MASTRACODE_JIRA_RECONCILE_ENABLED=false` to disable reconciliation or `MASTRACODE_JIRA_RECONCILE_INTERVAL_MS` to a positive millisecond interval to change its cadence.
- **GitHub:** Settings › Intake › GitHub routing maps a label to a board per Factory project (`GET`/`PUT /web/intake/label-routes`). Labels match case-insensitively; unrouted issues go to Work. Saving a route relocates matching cards the same way, and `issues.labeled` / `issues.unlabeled` webhooks move a card between its routed board and Work while refreshing its label metadata. Routes apply to every repository linked to the project; label input is free text (no repository label autocomplete yet).

A project's [intake routes](#intake-routes) are checked before these bindings and label routes. The bindings and label routes apply only to cards no intake route places.

### Intake routes

Each project has an ordered list of intake routes, managed through the API (there is no UI yet). A route names the board events it handles in `on`. A route on `work_item.created`, the default, decides where a new card lands: the first enabled route whose `when` matches the card names its board and phase. A route on `work_item.closed` or `work_item.reopened` decides where an existing card moves when its source closes or reopens (see [Status events](#status-events-move-existing-cards)).

**The default routes.** Every project starts with five routes: two that place new cards, and three that move cards when their issue closes or reopens. The first, `Outside authors wait in Intake`:

```json
{
  "when": {
    "operator": "AND",
    "conditions": [
      { "field": "source.integration", "operator": "in", "value": ["github", "gitlab"] },
      { "field": "author.trusted", "operator": "equals", "value": false }
    ]
  },
  "target": { "boardKey": "work", "phaseKey": "intake" }
}
```

It files GitHub and GitLab issues and pull requests from authors outside the write-access circle in Work › Intake, ahead of any label route or binding. Intake is a resting phase, so nothing starts there on its own. Any session, a person's or an agent's, can move the card on, and that move starts the next phase's run. Pushes to a pull request resting in Intake don't re-review it, and comments and edits on an issue never re-run Triage (see GitHub event rules). Trusted authors' cards, and Linear, Jira and incident.io cards (which carry no trust stamp), land where they did before. The second, `Pull requests go to PR review`, sends every other pull request and merge request (`source.kind equals pull_request`) to Work › PR review, where the reviewer runs once a person or the project's auto-run lets it start. Because it comes second, an outside author's pull request still waits in Intake. A pull request Factory opened for one of its own cards is filed by that card's rule, which no route re-places: it waits in Intake while the authoring card goes out for review.

The other three move Work cards when their issue's status changes:

| Route                                         | `on`                     | `when`                          | Target          |
| --------------------------------------------- | ------------------------ | ------------------------------- | --------------- |
| `Closed issues go to Done`                    | `["work_item.closed"]`   | `event.reason equals completed` | Work › Done     |
| `Issues closed as not planned go to Canceled` | `["work_item.closed"]`   | `event.reason equals canceled`  | Work › Canceled |
| `Reopened issues go back to Intake`           | `["work_item.reopened"]` | none                            | Work › Intake   |

They replace the close handlers each integration used to apply on its own, so a closed GitHub, GitLab, Linear, Jira or incident.io issue lands where it did before, but you can now edit or disable that move. To stop closes from moving Work cards, disable both close routes. Deleting them does not stop the move: with no route left that handles closes, Work's `sourceClosed` mapping moves closed cards to Done or Canceled again.

The default routes are stored routes like any other: list them, edit them, disable them, reorder them or delete them through the API. Factory adds each one once, the first time the project's routes are read or written, appending it after the project's existing routes, and doesn't add it back after an admin deletes it. Deleting a default is permanent: recreate it by hand to get it back. A project set up before the pull request route or the close and reopen routes existed gets them this way too.

**Trust only decides where a card arrives.** Once a card is moved out of Intake, later input on it runs like on any card: a maintainer's push re-reviews an outside author's pull request. A phase that should only auto-start for trusted authors says so in its `autoStartWhen` (`author.trusted equals true`). Runs on untrusted cards still use their own isolated memory.

**Route shape.**

| Field               | Meaning                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`              | Up to 120 characters.                                                                                                                                                                                                                                                                                                                                                                              |
| `enabled`           | Defaults to `true`. Disabled routes are skipped.                                                                                                                                                                                                                                                                                                                                                   |
| `on`                | The board events the route handles: `work_item.created` (the default), `work_item.closed` and `work_item.reopened`. Each at most once. `work_item.commented` and `work_item.edited` are activity, which never moves a card, so a route can't name them.                                                                                                                                            |
| `when`              | A rule over the card's facts (the same format as `autoStartWhen`). `null`, the default, matches every card. A route that handles more than `work_item.created` can also test `event.type` and `event.reason`.                                                                                                                                                                                      |
| `target`            | Required. `{ boardKey, phaseKey? }` sets where matching cards land; without `phaseKey` they land in the board's first phase. The board must be installed in the project (code or stored). For a route on `work_item.created`, the phase can't be terminal and must be reachable from the board's first phase; a route that only moves existing cards can target any phase, terminal ones included. |
| `allowWorkingPhase` | Defaults to `false`. A status move into a working phase (one that starts runs, such as Triage) is refused unless this is `true`, so a reopened card doesn't re-run Triage by accident.                                                                                                                                                                                                             |

Routes are evaluated in `position` order (0 first). Rules can test these card facts: `item.labels`, `item.title`, `item.author`, `source.kind` (`issue`, `pull_request`, …), `source.integration` (`github`, `gitlab`, `linear`, `jira`, `incidentio`, …) and `author.trusted`. `author.trusted` is `true` when the card carries an `authorTrusted: true` or `factoryAuthored: true` stamp. GitHub and GitLab stamp `authorTrusted` from the author's repository permission, and a stamp that is missing counts as untrusted.

**Placement.** When an integration files a new card, or a card is created without naming a board (the `factory_create_work_item` tool, or `POST /web/factory/projects/:id/work-items` without `board`), the first enabled route that matches the card and whose board can take it decides where the card lands. On the built-in boards, a pull request lands on Work only in Intake or PR review, PR review takes only pull requests, and Review takes only pull requests; a route a card can't take is skipped and the next one is tried. If the route's phase no longer exists, or can no longer be reached from the first phase, the card lands in the first phase. A card routed to a later phase enters the first phase and then moves on through the transition service as a system move, recorded in the card's history. The route makes this move, not a person, so it gives no consent to start work; a run the phase asks for still needs a person or the project's auto-run. A board whose transition policy refuses system moves refuses the route, and the card is not filed. If no route places a card, the integration's binding, label route or default decides.

A card a route placed records the route's id in its `intakeRouteId` metadata and stays on that board afterwards: a GitHub label change, a reconcile that replays a known issue, a label route change, and rebinding the card's source all leave it there (its labels still update). An edited route moves no existing card. If filing a card stopped partway (it entered the board's first phase but the move to the route's phase failed), the retry keeps the card on that board: it moves to the phase the route names now, or stays in the first phase when the route was deleted, disabled or pointed at another board. Cards no route placed keep following label routes and bindings as before. An explicit placement wins over routes, for example:

- a maintainer's review request that files a pull request directly in PR review;
- a custom rule with `skipRules`;
- a child card a board's own rule files;
- a board named when the card is created. The board's **New card** button always names its board, so routes never place cards made there.

Not covered: a pull request routed to a board other than Work or Review no longer gets Factory review, because review requests and pushes only act on pull request cards on those boards.

#### Status events move existing cards

Every integration reports issue status changes with the same names: `work_item.created` when an issue is first seen, `work_item.closed` when it closes, and `work_item.reopened` when it reopens (GitHub and GitLab; Linear, Jira and incident.io report opens and closes only). A close carries `event.reason`: `canceled` for GitHub's "not planned" and "duplicate" and for Linear, Jira and incident.io canceled states, `completed` otherwise (GitLab closes are always `completed`).

When one of these arrives for a card that already exists, the first enabled route on the card's board whose `on` names the event and whose `when` matches the card and the event moves the card to the route's phase:

- The move is a system move made by the route, recorded in the card's history (`by: intake-route:<routeId>`) and in the audit log (`factory.work_item.stage_moved` with `cause: event_route`, made by actor `intake-route:<routeId>`).
- The move clears the card's armed autonomy. A provider event is not a person's go-ahead, so a reopened card waits for a person or the project's auto-run before a phase run starts.
- It skips the board's `nextPhases`, so a reopened card can leave Done. It still checks that the phase exists and that the board's card lanes take the card (an issue never lands in PR review).
- It is refused with `approval_required` when the target is a working phase and the route doesn't set `allowWorkingPhase`.
- A move into a working or resting phase waits for a run in flight on the card to end, then moves the card. While it waits it goes back to the queue, so it never holds a dispatch slot.
- The source's last status wins. When an issue is closed and reopened before Factory applies the close, the close is dropped and the card stays where it was.
- A move into a terminal phase doesn't wait: it runs terminal cleanup like any other, so a session still running on the card is aborted at once, as a close always has.
- A close moves only an unfinished card, and a reopen only a finished one. Redelivered or reconciled webhooks move the card once.

Only routes targeting the card's own board apply; a route naming another board is skipped. A route on the card's board that names the event owns it even when it is disabled or its `when` doesn't match: the card stays put. Only on a board where no route names the event does the board's `sourceClosed` mapping apply, so custom boards keep closing as before. To stop closes from moving Work cards, disable both close routes: deleting them hands closes back to Work's `sourceClosed` mapping, which moves the card to Done or Canceled.

A deployment that answers an event itself keeps routes out of it: a handler or `null` set explicitly on the integration's `rules` for `issueClosed`, `issueReopened`, `issueCommentCreated` and so on, or `null` on the card's board handlers. An override that moves nothing really moves nothing. A board handler that wraps or returns the stock close move is different: that move still goes to the routes, as the stock handler's own would.

#### Activity reaches the card's session

A new comment on a card's GitHub or GitLab issue, or an edit to its title or description, tells the session working the card, with pointers only:

```text
New comment by @alice on acme/repo#42: https://github.com/acme/repo/issues/42#issuecomment-100
acme/repo#42 was edited by @bob (untrusted author): https://github.com/acme/repo/issues/42
```

The message never carries the comment's body or the issue's title: the session follows the link to read it. Authors without write access are marked `(untrusted author)`. Factory's own GitHub comments are skipped, and so are edits to an existing GitLab comment. An idle session is woken by GitHub activity from a trusted author. Activity from an untrusted author never wakes a session, and neither does GitLab activity: GitLab deliveries don't say whether Factory wrote a comment, so a session could otherwise wake itself with its own comments. That activity is sent as a `low` priority notification, which never starts a run: it waits in the session's notifications, and the session's next run is told it is there. Otherwise, activity while it is busy waits as one notification per card and kind of activity, counting how many arrived. A card nobody is working drops the message. Nothing starts: Triage still runs once. The card's feed shows the comment either way.

**Routes.** Reading needs a signed-in user of the project's organization. Changes need an organization admin when auth is enabled. Deleting or reordering routes renumbers the routes after it and bumps their `revision`, so an update sent with an older `expectedRevision` is refused with 409 and must be retried with the current one. Changes are recorded in the audit log as `factory.intake_route.created`, `updated`, `deleted` and `reordered`.

| Method   | Path                                                                  | Body                                                       | Result                                                                                                                                                                                                                                                                                              |
| -------- | --------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/web/factory/projects/:id/intake-routes`                             | —                                                          | `intakeRoutes` in order.                                                                                                                                                                                                                                                                            |
| `GET`    | `/web/factory/projects/:id/intake-routes/:routeId`                    | —                                                          | The route.                                                                                                                                                                                                                                                                                          |
| `POST`   | `/web/factory/projects/:id/intake-routes`                             | The route.                                                 | `201` and the route, added at the end. `422 unknown_board`, `unknown_phase`, `terminal_phase` or `unreachable_phase` for a target cards can't land on; `422 invalid_intake_route` for a bad `on` or a `when` testing `event.*` on a placement-only route. `409 intake_route_limit` past 100 routes. |
| `PATCH`  | `/web/factory/projects/:id/intake-routes/:routeId`                    | The fields to change, plus `expectedRevision`.             | The route.                                                                                                                                                                                                                                                                                          |
| `DELETE` | `/web/factory/projects/:id/intake-routes/:routeId?expectedRevision=n` | —                                                          | `204`.                                                                                                                                                                                                                                                                                              |
| `POST`   | `/web/factory/projects/:id/intake-routes/reorder`                     | `{ "ids": [...] }`: every route of the project, once each. | The routes in their new order. `409 intake_route_set_mismatch` if the list differs from the project's routes.                                                                                                                                                                                       |

A stale `expectedRevision` is refused with `409 revision_mismatch`. Each route reports `problems`, for example when its board has since been deleted. Such a route places no cards.

```bash
# Send issues from trusted authors straight to Triage.
curl -X POST "$FACTORY_URL/web/factory/projects/$PROJECT/intake-routes" -H 'content-type: application/json' -d '{
  "name": "Trusted issues to Triage",
  "when": { "operator": "AND", "conditions": [
    { "field": "author.trusted", "operator": "equals", "value": true },
    { "field": "source.kind", "operator": "equals", "value": "issue" }
  ] },
  "target": { "boardKey": "work", "phaseKey": "triage" }
}'

# Send issues closed as not planned to Done, too, instead of Canceled.
curl -X PATCH "$FACTORY_URL/web/factory/projects/$PROJECT/intake-routes/$CLOSED_CANCELED_ROUTE" -H 'content-type: application/json' -d '{
  "target": { "boardKey": "work", "phaseKey": "done" },
  "expectedRevision": 1
}'

# Send reopened bugs back to Triage to run again. A new route is added at the end, after the
# default reopen route that matches every reopen, so then move it ahead of that one with
# POST .../intake-routes/reorder.
curl -X POST "$FACTORY_URL/web/factory/projects/$PROJECT/intake-routes" -H 'content-type: application/json' -d '{
  "name": "Reopened bugs re-run Triage",
  "on": ["work_item.reopened"],
  "when": { "operator": "AND", "conditions": [
    { "field": "item.labels", "operator": "contains", "value": "bug" }
  ] },
  "target": { "boardKey": "work", "phaseKey": "triage" },
  "allowWorkingPhase": true
}'

# Let outside authors' issues go where label routes send them, instead of Intake.
curl -X PATCH "$FACTORY_URL/web/factory/projects/$PROJECT/intake-routes/$DEFAULT_ROUTE" -H 'content-type: application/json' -d '{
  "enabled": false,
  "expectedRevision": 1
}'
```

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

Pass the integration in `MastraFactory`'s `integrations` array. The direct `GithubIntegration` accepts the same `rules` option alongside its GitHub App credentials. A function replaces one default handler without composing with it. `null` disables that event's handler, not authentication, webhook ingestion, or reconciliation bookkeeping. Omitted events and `undefined` retain their defaults. Triage runs once per card: the default `issueEdited`, `issueCommentCreated`, `issueCommentEdited` and `issueCommentDeleted` handlers are `null` (as are GitLab's `issueUpdated` and `issueCommented`), so a person moves the card into Triage or starts the run to triage again. Supply a function for one of those events to re-run Triage on it. Each instance copies and freezes its resolved handler map; unknown event names and invalid handler values are rejected during construction.

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

Board definitions own lifecycle, topology, phase-semantics, and tool-result rules; nothing is configured globally. `MastraFactory({ configVersion })` supplies the deployment-owned label stamped on audit records and GitHub evaluations; it is not a hash of custom handler code, not ingress identity, and does not change delivery replay semantics. Update `configVersion` when changing handler behavior.

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

A delivery that concerns two cards is evaluated once per card, each under its own ingress identity: every decision is committed against one card, at that card's revision. A merged pull request is the standard case — its own card closes, and the built-in `pullRequestMerged` rule moves the Work item that wrote the code to Done. If that Work item has another pull request open, it stays where it is and its session is told which pull request is still out. An opening pull request is evaluated the same way. Its own card is filed in Work Intake by the arrival, the evaluation flagged `pullRequestIntake`, which is committed against the Work item that authored the pull request when provenance or a matching session branch names one; that binding is what links the new card to its item. The authoring item is then answered in a second evaluation of its own (`pullRequestIntake` unset), which is where a handler places the item that is now out for review. The built-in `pullRequestOpened` files the pull request's card on the arrival. On the authoring item's evaluation it moves that Work item from Building to Review when the pull request is open and comes from a trusted author or from Factory; otherwise it returns nothing.

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

Linking a GitLab repository imports its open issues and merge requests (up to five pages each). Without a webhook, later items are discovered when their lists are requested, and changed merge-request heads are recorded when the merge-request list is requested. Existing cards can still be reconciled. For ongoing issue changes, comments, and merge-request lifecycle events, configure the direct project webhook with `GITLAB_WEBHOOK_SECRET`.

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

### Linear workspace connections

For Platform-managed Linear connections, **Settings → Work Intake** connects and repairs workspaces in place. A disconnected workspace with saved sources shows **Reconnect** on the Linear card; healthy ones need no action. A disconnected workspace without saved sources has nothing paused, so it has no Reconnect; authorize it again with **Connect**. To add another workspace, choose **Connect** next to Linear under **Add a source**. During reconnection, choose the named workspace in Linear. Factory checks that workspace's connection when authorization returns.

Work Intake keeps disconnected workspaces' saved sources and routing. Their issues remain paused until access is restored. A request failure shows a retry action and does not mark the workspace disconnected. Sources and polling from healthy workspaces remain available when another workspace's source request fails.

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

`@<factory-app> re-review` is also accepted. Factory resolves `<factory-app>` from its observed or configured GitHub App login (without the `[bot]` suffix), so commands are ignored until that identity is known. The command creates and starts a first review pass for a missing or Intake card (new cards are filed on Work), restarts a completed card with `factory-rereview`, and is a no-op while a Reviewing card has no recorded verdict, because a pass is pending or running. Once a verdict is recorded, the card rests in Reviewing and the command re-enters it to start another pass with `factory-rereview`. Other prose, quoted mentions, edited comments, and comments from untrusted users do not trigger a run.

### Factory tools in user sessions

A person's own Factory session (a user session) gets tools to find, file and manage the Factory's work items through its agent. Factory scopes the tools from the stored session row, never from the thread's `factoryProjectId` tag: the session must belong to a Factory in the caller's organization, and a private session only works for its owner. With authentication disabled, the shared `local` tenant applies. Sessions doing work for someone else, either bound to a work item's run or started as a side session, only get `factory_message_origin`, so they can report back and answer messages.

| Tool                            | Input                                                                                                                                           |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `factory_list_work_items`       | Optional `query` (title text or `#number`), `stage`, `board`, `role`, `active`, `requestedBy: 'me'`, `subscribed`, `limit` (default 25, max 50) |
| `factory_inspect_work_item`     | `workItem` (id or `#number`)                                                                                                                    |
| `factory_list_attention`        | Optional `limit` (max 50)                                                                                                                       |
| `factory_create_work_item`      | `title`, `brief`, optional `repository` (`owner/name`, one this Factory links)                                                                  |
| `factory_update_work_item`      | `workItem` plus any of `title`, `repository`, `parentWorkItem` (or `null` to detach)                                                            |
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

`factory_create_work_item` files the card as the caller where the project's [intake routes](#intake-routes) send it, or in the Work board's first phase when no route matches, posts the brief as its first comment, and subscribes the session. Name the `repository` when the Factory links more than one: a run can't start on a card that doesn't say which. `factory_update_work_item` sets it afterwards, like choosing a repository on the card, and also edits the title, the parent item and plan pre-approval. Both refuse a repository the Factory doesn't link, and a card synced from an issue keeps the issue's repository. Stages, the board and role sessions aren't fields it edits; stages move with `factory_transition_work_item`. Subscriptions are stored per work item and session in the `factory_work_item_subscriptions` collection and are removed with the item, so any number of sessions can follow one item.

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

### Mastra Connect and your own tools in sessions

With Platform credentials and `MASTRA_PROJECT_ID`, every Factory session gets the [Mastra Connect](https://mastra.ai/docs/mastra-platform/connect) tools of each connection attached to the Platform project. Attach and remove connections in Mastra Platform, on the project's **Connect** page. The organization's other connections reach sessions only once they're attached, and a new project has none. **Settings → Tools** lists what sessions get, read from the same Platform list. Platform deploys get both variables automatically. Anywhere else, including locally, set `MASTRA_PROJECT_ID` and `MASTRA_PLATFORM_SECRET_KEY` or `MASTRA_PLATFORM_ACCESS_TOKEN`. Attach Linear, and a Slack thread, a web chat or a work item can ask about its issues.

Sessions run these tools without asking while automatic approval is on, so only attach accounts whose actions sessions may take. When a person turns approval off, the tools follow the `mcp` permission category, except in Slack with `adapterOptions.toolDisplay: 'text'`, where every tool call is approved automatically. Tools with `delete` or `archive` anywhere in their name, in any case, are left out. That check goes by name only, so it can't catch every destructive action, such as a SQL tool running a `DROP`. GitHub and GitLab Connect tools are left out too: Factory's own source-control tools enforce repository scope and self-review, and Connect's would skip both. Every user and organization on the Factory shares the project's connections, and a connection attached for another app on the same project reaches Factory sessions too. `GET /web/integrations/platform/connect-tools` backs the settings page.

Connect caches the connection list for 30 seconds. When a later refresh fails, sessions keep the last list it got, including a connection removed since, until a refresh succeeds. A run with no list yet waits at most 15 seconds for one, then goes on without Connect tools, and Factory logs why. If the Platform stalls instead of failing, later runs also go without them until that listing answers or fails.

`tools` replaces that default with the tools you choose: a record of tools, such as an MCP server's, or a function that returns them for each run from its `requestContext`. `tools: {}` offers none. Factory doesn't filter the tools you pass: the example below includes `linear_delete_issue`, so narrow it with Connect's `allowTools` or `disallowTools`.

```typescript
import { tools as connectTools } from '@mastra/connect';
import { MastraFactory } from '@mastra/factory';

const factory = new MastraFactory({
  // ...
  tools: connectTools({ providers: ['linear'] }),
});
```

A tool named like one Factory already gives the session, such as `linear_get_issue` from a connected Linear integration, is not offered, and Factory logs that once per name. When resolving the tools you pass throws, the run fails with that error.

Factory doesn't read MCP servers from the host's `mcp.json` files, and logs a warning at startup when `~/.mastracode/mcp.json` exists. Pass MCP tools through `tools` instead:

```typescript
import { MCPClient } from '@mastra/mcp';

const mcp = new MCPClient({ servers: { tickets: { url: new URL('https://tickets.example.com/mcp') } } });

const factory = new MastraFactory({
  // ...
  tools: await mcp.listTools(),
});
```

### Voice input

The composer mic first asks `POST /web/voice/live-session`. When the chosen model has a realtime model (Mistral Voxtral), the server mints a short-lived Mistral `rt_` token with the selected key and the browser streams 16 kHz PCM to Mistral's realtime socket, so words appear in the draft while you speak. Every other provider answers `{ mode: 'batch' }`, and so does Mistral when it won't mint a token for a key that can still transcribe (for example one without the `create_client_session` permission): the browser records a clip and posts it to `POST /web/voice/transcribe`, where the server transcribes it with a provider from the Mastra Code speech-to-text registry (`@mastra/code-sdk/voice/stt-registry`). A rejected or out-of-credit Mistral key answers 502 before anything is recorded; other providers report a bad key only when the clip is transcribed. API keys never reach the browser. Each member can start 20 live sessions or transcriptions a minute on each server process (the counters are in memory); past that both routes answer 429 `voice_rate_limited` with `Retry-After`, before anything is recorded. Only a minted live session or a transcription counts, so when Mistral won't mint a token and the browser records a clip instead, that dictation counts once.

Voice input resolves its model and key the way an interactive chat in the same Factory does:

- `factory` model scope: the Factory's voice model with organization keys. Only organization admins change the model.
- `user` or `hybrid` model scope: each member's own voice model with personal keys. Organization keys are never used.

Either side starts on auto, the first registry provider with a key. OAuth subscriptions are never used. With sign-in enabled, keys come only from stored credentials; in local mode the provider env var applies before a stored key. `GET`/`PUT /web/voice/settings` back **Settings → Models → Voice input**.

Voice clips recorded in Slack and sent to a Factory session (a mention, a DM, or a thread the bot is in) are transcribed the same way under the thread's Factory, with the sender as the member, before the agent sees the message. A thread with no Factory session uses the sender's own voice model and key. The transcript replaces the clip. A clip that can't be transcribed is dropped from the message and the sender gets a card only they can see, with the reason and, for a missing, rejected or out-of-credit key, an **Open voice settings** button; when nothing but mentions is left in the message, the agent doesn't run. Uploaded audio files stay attachments.

### MCP server (Claude, ChatGPT and other MCP clients)

A Factory with an auth provider and an OAuth authorization server serves an MCP endpoint over Streamable HTTP:

```
https://<your-factory>/web/factory/projects/<projectId>/mcp
```

The Factory UI does not show this URL while the MCP endpoint is being reworked. Build it from your Factory URL and project id as shown above.

It exposes the Factory tools a signed-in web session has (list, inspect, create, update and transition work items, start and signal sessions, decisions, approvals), plus `search` and `fetch` over work items for ChatGPT. Each tool carries MCP annotations (read-only, destructive, idempotent) so clients can ask before changes.

Callers must sign in. Requests without a valid bearer token get `401` with a `WWW-Authenticate` header pointing to the RFC 9728 metadata at `/.well-known/oauth-protected-resource/web/factory/projects/<projectId>/mcp`. Tokens go through the same auth provider and org checks as the web UI. When the Factory has a linked repository, each user gets one private connector session per Factory that the session tools act from.

To connect a client:

- **Claude** (claude.ai and Claude Desktop): open **Settings → Connectors → Add custom connector**, paste the endpoint URL, then sign in when asked. Claude connects from Anthropic's servers, so the Factory must be reachable over public HTTPS.
- **ChatGPT**: open **Plugins**, select **+ → Add custom MCP server**, paste the endpoint URL, and choose OAuth. ChatGPT also connects from its own servers and speaks MCP `2026-07-28`.

The endpoint speaks MCP `2026-07-28` (clients open with `server/discover`). Clients that still open with a 2025-era `initialize` request, such as VS Code and Cursor, are served too, statelessly: they sign in the same way and get the same tools, but no session id, no `GET` event stream and no activity events. CORS allows the `Mcp-Protocol-Version`, `Mcp-Method` and `Mcp-Name` request headers and exposes `WWW-Authenticate`, so browser-based clients can connect too, from any origin the server's CORS settings accept.

Factories on Mastra Platform auth advertise Platform's AuthKit (`https://auth-kit.mastra.ai`) automatically. With other auth providers, set the authorization server the metadata advertises, or the endpoint isn't served:

```ts
new MastraFactory({
  // ...
  mcp: { authorizationServers: ['https://your-tenant.authkit.app'] },
});
```

or set `MASTRA_FACTORY_MCP_AUTHORIZATION_SERVER`. Pass `mcp: false` to turn the endpoint off.

#### Activity events (experimental)

The endpoint serves one MCP event type (SEP-3415, experimental in `@mastra/mcp`), `factory.activity`, so clients can notice changes without re-reading work items. It is poll-only: call `events/poll`; `events/stream` and webhooks aren't offered.

Claude and ChatGPT don't consume these events yet: Claude connectors have no events support, and ChatGPT only uses webhook delivery. Today they're for clients that call `events/poll` themselves.

```json
{
  "method": "events/poll",
  "params": { "name": "factory.activity", "arguments": { "workItemId": "<id>" }, "cursor": null }
}
```

- `arguments` are optional: `workItemId` narrows to one work item, `actions` to specific audit actions (for example `factory.work_item.updated`).
- A `null` or missing cursor starts from now and returns no events. Pass back the returned `cursor` on each poll. Any other cursor the Factory can't read, including `""`, restarts from now and marks the result `truncated`.
- An event is delivered once it is 5 seconds old, so events written while a poll runs aren't skipped.
- With `maxAgeMs`, older events are skipped and the result is marked `truncated`.
- Each event's `eventId` is its audit row id, and the payload has `action`, `occurredAt`, `actor`, a one-line `summary`, and `workItemId` and `sessionId` when the event is about a work item or session.
- Work item and session activity is served: item changes, runs, approvals, signals, and agents' commits, pushes and pull requests. Sessions follow the same rule as everywhere else in the Factory: you see your own sessions and shared ones, never another member's private session. Work item activity always shows up: when it happened in a session you can't see, the event says `privateSession: true` and the summary ends with "(in a private session)", but it doesn't say which session. Activity on such a session alone is left out.

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
