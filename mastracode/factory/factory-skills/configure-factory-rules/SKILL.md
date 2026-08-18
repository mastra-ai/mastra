---
name: configure-factory-rules
description: Configure typed Mastra Factory rules and exact-leaf overrides in deployment code
---

# Configure Factory Rules

Help the user change Factory policy in the typed deployment configuration. Factory rules are trusted server code. Never place deployment policy in this skill, repository instructions, browser code, or a parallel actions system.

## Find the configuration

1. Search for `new MastraFactory`, `defaultFactoryRules`, and the `rules` property.
2. Read the existing rule configuration and its tests before editing.
3. Import rule helpers and types from the same local Factory module used by the deployment.
4. If the deployment doesn't configure `rules`, start with `defaultFactoryRules({ version, overrides })` and pass the result to `MastraFactory`.

Do not guess a file path. Factory deployments can assemble `MastraFactory` from different entry points.

## Preserve the public shape

Use one rules tree:

- `work.<stage>.<source>.onEnter` or `onExit`
- `review.<stage>.<source>.onEnter` or `onExit`
- `tools.<toolName>.onResult`
- `github.<event>.onEvent`

Do not create an `actions` config or execute authoritative policy in React. Each handler returns one typed `FactoryRuleDecision` or `undefined`.

Work and Review cards move independently. Never mirror their stages or mark Work Done only because a pull request merged.

## Apply exact-leaf overrides

An override replaces the exact handler leaf. It does not compose with the built-in handler at that leaf. Sibling leaves remain unchanged.

Before replacing a built-in leaf:

1. Read the built-in handler in `src/web/factory/rules/defaults.ts`.
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
