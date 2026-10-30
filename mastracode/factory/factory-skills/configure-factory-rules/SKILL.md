---
name: configure-factory-rules
description: Configure board-owned lifecycle, policy, phase-semantics, and tool-result rules, plus integration event rules
---

# Configure Factory Rules

Help the user change Factory policy in the typed deployment configuration. Factory rules are trusted server code. Never place deployment policy in this skill, repository instructions, browser code, or a parallel actions system.

## Find the configuration

1. Search for `new MastraFactory`, its `boards` and `includeDefaultBoards` options, `defineBoard`, `configVersion`, and the installed `GithubIntegration`, `PlatformGithubIntegration`, `LinearIntegration`, or `PlatformLinearIntegration` constructors and their `rules` options.
2. Read the existing rule configuration and its tests before editing.
3. Import rule helpers and types from the same local Factory module used by the deployment.
4. For custom-board handlers or phase semantics (`kind`, `role`), edit the installed `defineBoard()` definition. For tool-result rules, add `tools: { <toolName>: { onResult } }` to the installed `defineBoard()` definition of the board whose seat produces the result. For GitHub or Linear rules, configure the installed integration constructor directly.

Do not guess a file path. Factory deployments can assemble `MastraFactory` from different entry points.

## Preserve the public shape

Installed board definitions exclusively own lifecycle handlers: use `phases.<phase>.onEnter.<source>` and `phases.<phase>.onExit.<source>` in `defineBoard()`. Sources are `issue`, `pullRequest`, `linearIssue`, and `manual`. Work and Review install automatically with preferred defaults. Custom boards are installed through `boards`; `includeDefaultBoards: false` supports custom-only installations.

Remove former global `rules.work` and `rules.review` configuration. There is no board override API. To customize Work or Review, set `includeDefaultBoards: false` and install a same-ID board, preferably using the exported `workBoard` or `reviewBoard` phases as the starting point. Keep the built-in phase names and roles unless the changed runtime and UI behavior is intentional. There is no global rules tree; `new MastraFactory({ rules })` throws. Set `configVersion` on `MastraFactory` for the audit label. Tool-result rules resolve only from the item's installed board: Work declares `submit_plan`, Review declares none, and custom boards inherit nothing.

By default, every integration arrival stays in its routed board's initial phase (Intake for Work and Review) without starting or suggesting a run. This applies to GitHub, GitLab, Linear, Jira, and incident.io; explicit trusted GitHub review requests without an existing card go directly to Reviewing. Do not restore default arrival automation on the built-in boards.

`authorTrusted` and `autoStartCandidate` remain available as metadata for custom rules. A custom board can add guarded arrival triage on its initial phase by checking both `context.cause === 'linked_item_materialized'` and `context.item.metadata?.autoStartCandidate === true`, then returning an `invokeSkill` decision for `factory-triage`.

Configure GitHub on the installed `GithubIntegration` or `PlatformGithubIntegration` constructor, and Linear on `LinearIntegration` or `PlatformLinearIntegration`, instead:

```typescript
new PlatformGithubIntegration({ rules: { issueCommentCreated: null } });
new PlatformLinearIntegration({ rules: { issueClosed: null } });
```

When Platform credentials are present the factory installs `PlatformGithubIntegration` itself, so forward the same options with `new MastraFactory({ platform: { github: { rules, slug } } })` rather than constructing the integration; an explicit `integrations` entry with id `github` still takes precedence and makes that key a no-op, and the factory warns instead of ignoring it silently.

GitHub and Linear integrations exclusively own their event handlers; configure them through constructor `rules[event]`, not the global Factory rules tree. Move former `rules.linear[event].onEvent` values to the Linear constructor's `rules[event]`. Every built-in handler is enabled automatically; never import or spread defaults just to install an integration. A function replaces the default, `null` disables that event's handler, and omitted or `undefined` values retain defaults. Constructors validate names and handler values, then copy and freeze the effective map per instance. Disabling a handler does not disable authentication, ingestion, or reconciliation bookkeeping. Linear fetch, platform polling, and reconciliation all use the owning instance's handlers.

Do not create an `actions` config or execute authoritative policy in React. Each handler returns one typed `FactoryRuleDecision` or `undefined`.

A pull request's own card and the Work card that authored it move independently, whether the pull request card sits on Work or on the legacy Review board. Never mirror their stages or mark Work Done only because a pull request merged.

## Restrict where agents move cards

Topology (`nextPhases`) declares the moves that exist for everyone, people included. To keep agents out of a phase, set `agentEnterWhen` on that phase in the board definition: a rule over card facts, or `false` for "agents never". People and board rules (lifecycle, tool-result and integration handlers) are never checked. Do not add restrictions to the generic transition service or global rules.

```typescript
shipped: {
  name: 'Shipped',
  kind: 'terminal',
  // Agents may close only cards with no open pull request.
  agentEnterWhen: { operator: 'AND', conditions: [{ field: 'item.openPullRequest', operator: 'not_exists' }] },
},
```

Card facts: `item.labels`, `item.title`, `item.author`, `source.kind`, `source.integration`, `item.phase` (where the card is now), `item.openPullRequest`, `item.reviewVerdict`, `item.selfReviewVerdict`, `item.selfReviewNeedsHuman`. A missing fact matches only the negative operators (`not_exists`, `not_equals`, `not_contains`, `not_in`); write rules so a missing fact keeps the gate closed where that matters. Read `src/boards/work.ts` for Work's rules (no skipping Planning, Done guards, parked cards) and `src/boards/review.ts` for Review (`done` is `false`).

A working phase whose `exitTool` has a board tool rule (`tools[exitTool.id]`) leaves through that tool: anyone but a person asking to move the card on to another working phase is rejected unless the exit tool is auto-approved for the card. Work's Planning uses `submit_plan` this way.

`transitionPolicy` is deprecated: it still runs for boards that set it and logs one warning per board. Do not add new policies; move existing ones to `agentEnterWhen`. Factory no longer records triage classification or acceptance: Work's triage agent sends open non-bugs back to Intake, and a person moving the card on is the approval. Custom boards inherit none of Work's rules through phase or role names.

## Configure board phase semantics

Every phase in `defineBoard()` requires `kind: 'resting' | 'working' | 'terminal'`; working phases also require `role`. Read `src/boards/define-board.ts` for validation and the derived helpers (`phaseKind`, `isWorking`, `isTerminal`, `roleForPhase`, `phaseForRole`) and `src/boards/semantics.ts` for how runtime resolves an item's board and phase. Work and Review declarations live in `src/boards/work.ts` and `src/boards/review.ts`.

Runtime reads the installed board's declarations for consent arming, the external-author guard, kickoff seating, run-start lanes, terminal cleanup, and sweeps; nothing name-matches phases, and custom boards inherit nothing from Work. `initialPhase` must be resting. Unknown board or phase fails closed: consent is requested, nothing is cleaned up, no seat is started or revoked.

To make a custom phase terminal or seat an agent in it, change its `kind`/`role` in the definition. Do not add phase-name checks to the transition service, dispatcher, or sweeps. Bound transition tools accept custom phase identifiers and validate live membership and topology on the item's installed board.

## Execute a custom board

Use the custom-board execution example in the Factory README as the configuration pattern. Board and phase identifiers are case-sensitive, 1–128 letters, digits, underscores, or hyphens, beginning with a letter or digit, without surrounding whitespace. Lifecycle, tool-result, and integration decisions may target installed custom phases. Validate membership on the target board, never against a union of installed phase names.

A `transition` decision stays on the item's assigned board. An `upsertLinkedWorkItem` decision may target another installed board; materialization enters that board's declared initial phase before the requested destination. Neither decision can reassign an existing card. Targets are checked before acceptance and before uncommitted deferred effects execute. Preserve committed replay and its original `configVersion` even if the installed configuration changes.

Working roles identify bindings on the shared Code Agent, not separately configured agents. There is no per-role agent registration option. Declare `invokeSkill` decisions with the working role and a board-owned prompt (or an available skill); do not invent an `agents` configuration. For automatic session preparation, verify the deployment's GitHub integration, project connection and linked repository, sandbox, organization model credentials, and project automatic-run setting. Enter a working phase through the public transition route as an authorized human when approval is required.

Verify the actual journey: initial entry, lifecycle kickoff, the declared role's phase signal and binding, a bound transition tool, role handoff, completed tool-result ingestion, deferred transition, and terminal cleanup. Polling and persisted-message ingestion resolve the single current phase through the installed board. Live binding, reassignment, revision, topology, approval, and external-author checks still apply. Custom roles named `triage` inherit nothing from Work. A tool-result handler receives normalized `result.status` and `result.value`; it does not receive raw tool arguments. Check the result payload the board's rules need rather than treating every completed tool call as business success.

Keep the remaining limits explicit: `factory-ui` still uses built-in stages and roles, completion metrics still use Work's `done` phase, and `held-waiting` is Work-specific. Existing integration defaults do not automatically route events to a custom board.

## Change a built-in handler

Integration overrides (`rules[event]` on the GitHub/Linear constructor) replace one event handler; they do not compose with the built-in handler, and siblings remain unchanged. To replace a board-owned handler, set `includeDefaultBoards: false` and install a same-ID board with the desired handler. For Work's `submit_plan` tool-result rule, declare `tools.submit_plan.onResult` on the replacement `work` board. The stock handler lives in `src/boards/work-tool-rules.ts`.

Before changing a built-in handler:

1. Find and read it: GitHub handlers live in `src/integrations/github/default-rules.ts`, Linear handlers in `src/integrations/linear/default-rules.ts`, Work's tool-result handler in `src/boards/work-tool-rules.ts`, and Work and Review lifecycle/policy defaults in `src/boards/work.ts` and `src/boards/review.ts`. Custom handlers live in their installed definitions.
2. Decide whether the replacement must preserve part of that behavior explicitly.
3. Use only fields exposed by the typed context. Do not reach into Factory storage or raw webhook payloads.
4. Return `undefined` to allow the ingress with no decision, or return a typed rejection or bounded structured decision.
5. Give every effect decision a stable `idempotencyKey` derived from immutable ingress identity.

## Version changes

Set an explicit, deployment-owned `configVersion` on `MastraFactory`. Change it whenever rule behavior changes. It labels persisted evaluations and audit records (stored in the `rule_set_version` column); it must not be used as event identity or added to ingress deduplication keys.

## Safety rules

- Keep handler work within the five-second evaluation budget.
- Treat rule callbacks as trusted deployment code, not repository-provided code.
- Keep rejection reasons short and safe to persist and display.
- Never expose credentials, storage handles, worktree paths, or raw webhook payloads to handlers.
- Trust GitHub actors only after server-side permission resolution. Only `write` and `admin` are trusted; failures are untrusted.
- Request follow-up transitions through `FactoryRuleDecision`. Never mutate stage storage directly.
- Defer skill, message, notification, and linked-item effects. Never execute them inside evaluation.
- Keep causal transitions bounded and include a stable idempotency key.

## Verify the change

1. Add or update focused tests for the replaced leaf and its unaffected siblings.
2. Test `undefined`, accepted, and rejected paths when they apply.
3. Run the narrow Factory rule tests and package typecheck.
4. Run the Web build to confirm the skill and deployment output are packaged.
5. Summarize the leaf replaced, behavior retained or removed, version change, and commands run.

Do not weaken tests or bypass the transition service to make a policy work.
