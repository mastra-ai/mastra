---
name: design-rules
description: Add, change, or remove a rule in the playground-ui design guidance (packages/playground-ui/design/). Use when a review, a bug, or a decision shows that a design rule is missing, wrong, or out of date, when someone says "make this a rule", "update the design rules", or "the rule says X but the code does Y", or when a rendered page needed a fix that a rule should have prevented.
---

# Changing a design rule

The rules in `packages/playground-ui/design/rules/` are what every agent and teammate builds from, so a wrong rule spreads to every screen built after it. Change one only with evidence, in the file that owns the topic, in the same PR as any code it describes.

## 1. Decide whether it earns a rule

A rule needs one of these:

- two independent examples of the same problem or decision (two comments about one change count once)
- one failure that cost something real: a shipped bug, an inaccessible control, a broken state
- an explicit call from a frontend code owner (`.github/CODEOWNERS`, `/packages/playground-ui/`), within the scope they stated

One reviewer's preference on one PR is an observation. Mention it in the PR, do not write it into a rule.

Before writing anything, check whether the code already decides it. When a rule and the code disagree, the code wins: the fix is to correct the rule, not to add an exception.

## 2. Find the owner

Paths are under `packages/playground-ui/design/`.

| The rule is about                                                              | File                        |
| ------------------------------------------------------------------------------ | --------------------------- |
| Restyling, arbitrary values, raw elements, imports, what every change follows  | `rules/core.md`             |
| App shell, page width and header, actions, page body, page states, filter bars | `rules/page-frame.md`       |
| Text entry, choices, forms, buttons, links                                     | `rules/controls.md`         |
| Status, badges, color, opacity                                                 | `rules/color-and-status.md` |
| Text roles, monospace                                                          | `rules/text.md`             |
| Visible words, errors, numbers, times                                          | `rules/copy.md`             |
| Charts and pages that are mostly charts                                        | `rules/charts.md`           |
| URL state, unsaved changes, loading flicker, props API                         | `rules/interface.md`        |
| Adding a component to `src/ds/`                                                | `build-component.md`        |

Read the whole owning file first. If the point is already covered, change that line instead of adding a second one.

## 3. Write the rule

- Say what to do in a tree branch or a MUST, with numbers and named components, not "where appropriate".
- Add one sentence on what breaks without it. A rule without its reason gets applied where it should not and dropped where it should hold.
- State the scope and name the exceptions.
- When an obvious alternative was tried and lost, say so in one line, so the next agent does not reach for it.
- End the rule with a link to your PR: `([#12345](https://github.com/mastra-ai/mastra/pull/12345))`.
- A rule names what two screens share, not what they look like. "These two pages look alike" is not a rule.

Keep every name traceable to the code. A rule that names a token, variant, or prop the package does not have teaches agents to invent it. Check `theme/*.css` for tokens and the component's `cva` block or props type for variants.

## 4. Change everything it touches, in one PR

- When the rule needs a value, variant, or API change, make that code change in the same PR.
- Update `examples/pages/` if any example breaks the new rule, and run `pnpm --filter ./packages/playground-ui typecheck`, which also typechecks the examples.
- Search the repository for the old wording and fix every copy: `packages/playground-ui/README.md`, `AGENTS.md` and `CLAUDE.md` files, and `.claude/skills/mastra-frontend/`.
- Search for the places the rule applies (for example `rg -n 'variant="ghost"[^>]*render=' packages mastracode`). Fix them in the PR when there are few; otherwise list the count in the PR and leave a follow-up ticket.

## 5. Open the PR

The PR description is the record. It holds:

- the rule's old and new text
- the evidence: links and short quotes, or the code owner's decision and its scope
- the alternatives that lost, and why
- the search from step 4 and what it found

A frontend code owner who did not write the proposal approves it. That review covers both the design decision and the code. Add a `patch` changeset for `@mastra/playground-ui`, since the rules ship with the package.

## Checklist

- [ ] The rule has evidence from step 1, and the code agrees with it
- [ ] It lives in the owning file, replacing any older line on the same point
- [ ] It says why, states its scope, and links this PR
- [ ] Every name in it exists in the code
- [ ] Examples, README, agent files, and `mastra-frontend` no longer contradict it
- [ ] The PR description holds the evidence, the rejected alternatives, and the search results
