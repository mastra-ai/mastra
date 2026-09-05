---
name: configure-factory-rules
description: Configure definition-owned board handlers, integration event rules, and global tool-result rules
---

# Configure Factory Rules

Help the user change Factory policy in the typed deployment configuration. Factory rules are trusted server code. Never place deployment policy in this skill, repository instructions, browser code, or a parallel actions system.

## Find the configuration

1. Search for `new MastraFactory`, its `boards` and `includeDefaultBoards` options, `defineBoard`, `defaultFactoryRules`, and the installed `GithubIntegration`, `PlatformGithubIntegration`, `LinearIntegration`, or `PlatformLinearIntegration` constructors and their `rules` options.
2. Read the existing rule configuration and its tests before editing.
3. Import rule helpers and types from the same local Factory module used by the deployment.
4. For custom-board handlers, edit the installed `defineBoard()` definition. For tool rules, use `defaultFactoryRules({ version, overrides: { tools } })` and pass the result to `MastraFactory`. For GitHub or Linear rules, configure the installed integration constructor directly.

Do not guess a file path. Factory deployments can assemble `MastraFactory` from different entry points.

## Preserve the public shape

Installed board definitions exclusively own lifecycle handlers: use `phases.<phase>.onEnter.<source>` and `phases.<phase>.onExit.<source>` in `defineBoard()`. Sources are `issue`, `pullRequest`, `linearIssue`, and `manual`. Work and Review install automatically with preferred defaults. Custom boards are installed through `boards`; `includeDefaultBoards: false` supports custom-only installations.

Remove former global `rules.work` and `rules.review` configuration. Built-in customization is deferred: do not invent a board override API, derive replacements, or use reserved IDs `work` and `review`. The global rules tree contains only `version` and `tools.<toolName>.onResult`.

Work automatic intake requires both `linked_item_materialized` and `autoStartCandidate: true`. Do not remove these guards to reproduce the web deployment's former unconditional intake override. Noncandidate and manual arrivals stay unstarted merely from entering Intake; explicit issue triage and human-approval safeguards remain. Linear Intake and Review retain their existing defaults and guards.

Configure GitHub on the installed `GithubIntegration` or `PlatformGithubIntegration` constructor, and Linear on `LinearIntegration` or `PlatformLinearIntegration`, instead:

```typescript
new PlatformGithubIntegration({ rules: { issueCommentCreated: null } });
new PlatformLinearIntegration({ rules: { issueClosed: null } });
```

GitHub and Linear integrations exclusively own their event handlers; configure them through constructor `rules[event]`, not the global Factory rules tree. Move former `rules.linear[event].onEvent` values to the Linear constructor's `rules[event]`. Every built-in handler is enabled automatically; never import or spread defaults just to install an integration. A function replaces the default, `null` disables that event's handler, and omitted or `undefined` values retain defaults. Constructors validate names and handler values, then copy and freeze the effective map per instance. Disabling a handler does not disable authentication, ingestion, or reconciliation bookkeeping. Linear fetch, platform polling, and reconciliation all use the owning instance's handlers.

Do not create an `actions` config or execute authoritative policy in React. Each handler returns one typed `FactoryRuleDecision` or `undefined`.

Work and Review cards move independently. Never mirror their stages or mark Work Done only because a pull request merged.

## Apply supported overrides

Tool-result overrides replace the exact handler leaf. Integration overrides replace one event handler. Neither composes with the built-in handler; siblings remain unchanged. Board handlers belong to their definitions, not this override mechanism.

Before replacing a built-in leaf:

1. Find and read the built-in handler: GitHub handlers live in `src/integrations/github/default-rules.ts`, Linear handlers in `src/integrations/linear/default-rules.ts`, and tool defaults in `src/rules/defaults.ts` within the Factory package. Inspect Work and Review defaults in `src/boards/work.ts` and `src/boards/review.ts`, and custom handlers in their installed definitions.
2. Decide whether the replacement must preserve part of that behavior explicitly.
3. Use only fields exposed by the typed context. Do not reach into Factory storage or raw webhook payloads.
4. Return `undefined` to allow the ingress with no decision, or return a typed rejection or bounded structured decision.
5. Give every effect decision a stable `idempotencyKey` derived from immutable ingress identity.

## Version changes

Set an explicit, deployment-owned `version`. Change it whenever rule behavior changes. The version identifies persisted evaluations and audit records; it must not be used as event identity or added to ingress deduplication keys.

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
