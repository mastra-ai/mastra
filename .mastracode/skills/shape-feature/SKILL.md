---
name: shape-feature
description: Interrogate a feature in exhaustive detail with the user, then — only after an explicit confidence gate and explicit opt-in — decompose it into dependency-ordered GitHub issues
---

# Shape Feature

Turn a large feature into a well-understood spec and, when the user opts in, a set of dependency-ordered GitHub issues. The interrogation is the substance; decomposition is a gated payoff, never the default.

**Interactive by design — do not run unattended.** This skill waits for and solicits human input throughout, the opposite of pipeline skills (`factory-plan`, `factory-triage`), which state "never wait for or solicit human input mid-run." Never invent answers to questions you should ask. If there is no human to answer (e.g. a dispatcher-driven run), stop and do not proceed. For the same reason this skill must never be wired into an `invokeSkill` board rule.

**Shell note:** `gh` output often contains ANSI color codes that break `jq`. Use `gh`'s built-in `--jq` flag instead of piping to `jq`, or prefix commands with `NO_COLOR=1`.

## Input

`$ARGUMENTS` may carry the feature (name, summary, or a link to an issue/PR). If it is missing or empty, ask the user what feature we are shaping before doing anything else.

## Phase 0 — Ground before asking

Do this research before the first question, so questions are sharp rather than generic requirements-gathering.

1. Identify the code the feature touches (`rg`/`find` for relevant symbols, routes, schemas; `git log` on those files for recent direction).
2. Read the relevant docs (`factory_read_document` for `docs/factory/` kinds, or the plain docs) for the affected area.
3. Check for overlap: `gh issue list --search "<feature terms>" --state open --json number,title,labels --limit 20` and `gh pr list --search "<feature terms>" --state all --json number,title,state --limit 20`.
4. Present a 3–6 line grounding summary — what exists today, what the feature touches, what you found in existing issues — and let the user correct it before questions start.

A good question names the actual surface: not "what are the requirements?" but "this touches the dispatcher's retry path; must your change preserve the existing backoff?"

## Phase 1 — Interrogate in loops

Small batches of lettered questions (A, B, C… continuing across batches), each batch driven by the previous answers. Keep responses short and dense; the user should spend their attention on answers, not walls of text.

Before the gate can pass, every area below must be covered. Track the running answers per area:

- **Behavior** — each user-visible behavior, stated concretely enough to write a test against
- **Scope** — in-scope and an explicit, non-empty "not this" list
- **Data & migration** — new/changed data, storage, migrations, backfill
- **Failure modes** — what can fail, and the defined outcome for each
- **Backward compatibility** — what existing behavior/contracts must keep working
- **Security & permissions** — authz changes, new attack surface, secret handling
- **Observability** — logs, metrics, traces that prove it works in production
- **Test strategy** — how each behavior will be tested
- **Appetite** — the timebox for this feature
- **Ships later** — what is explicitly deferred

Every vague answer gets a follow-up question, never a silent note. If an answer is "it should handle errors gracefully", ask "which errors, and what should happen for each?" Do not move on until each area has concrete answers.

## Phase 2 — Confidence gate

Decomposition is blocked until ALL of the following hold:

1. each behavior is concrete enough to write a test against
2. every failure mode has a defined outcome
3. the scope boundary is explicit and the "not this" list is non-empty
4. no open unknown requires the user to go find out something they do not currently know — unless it is named as a spike card with a defined question (investigating it is a legitimate way to pass)
5. data and migration impact is settled
6. the files and contracts each piece touches can be named

Report the result explicitly, e.g. `Gate: 3 of 6 passed — unresolved: failure modes, migration, scope edge.` If it fails, return to Phase 1 loops on the failing areas. The standard being enforced must be visible, not a silent stall.

## Phase 3 — Spec artifact

Always write `.artifacts/shape-feature/<slug>.md`, where `<slug>` is the kebab-case feature name. This is written BEFORE any issue is created and is the durable output even if decomposition never runs; it is also the record a human re-reads before approving issue creation.

Sections:

- Feature (one paragraph), plus the grounding summary from Phase 0
- Behaviors — testable statements, one per line
- Scope — in / not this
- Data & migration
- Failure modes — each with its defined outcome
- Backward compatibility
- Security & permissions
- Observability
- Test strategy
- Appetite
- Ships later
- Unknowns & spike cards
- Gate result (from Phase 2)
- Decomposition (added in Phase 4) and issue numbers (added in Phase 5)

## Phase 4 — Decompose (only after the gate passes)

Size cards so each is independently reviewable and mergeable. If two cards cannot merge separately, they are one card. For each dependency edge, classify:

- **hard** — B cannot compile or run without A. Only hard edges should ever gate dispatch.
- **soft** — B is merely easier after A.
- **shared-surface** — both touch the same file; sequence them to avoid conflicts.

Record the card list with edge classifications in the artifact.

## Phase 5 — Create issues (explicit opt-in, two passes)

**STOP GATE.** The default is a dry run: report the artifact path and the decomposition, and stop. Do not create issues unless the user explicitly opts in.

Before creating, state the auth context: issues created by a trusted collaborator (e.g. a maintainer's personal `gh` auth) WILL auto-start Factory triage on arrival (`linked_item_materialized` + `autoStartCandidate`); issues created by a Factory sandbox's App auth WILL NOT. Say which is in effect so the user can expect or prevent the auto-started runs.

Two passes, because `Blocked by: #12` cannot be written before #12 exists:

1. **Create all:** `gh issue create` for every card in dependency order, capturing each assigned number into the artifact as you go.
2. **Patch dependencies:** `gh issue edit <n>` to append the dependency lines in the fixed, machine-parseable format:

```text
Blocked by: #12, #14
Blocks: #19
```

Only hard and shared-surface edges need `Blocked by:` lines to be meaningful; soft edges still live in the issue body prose and always in the artifact.

Update the artifact between passes (numbers, created/patched status) so a mid-run crash is recoverable instead of leaving orphaned issues. Nothing parses `Blocked by:` yet — it is a convention for future tooling, so the format must stay exact.

## Done

Report: the artifact path, the gate result, and — if issues were created — their numbers and a one-line dependency summary.