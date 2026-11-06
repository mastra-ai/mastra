# Mastra design system guidance

This folder tells a person or an agent how to build Mastra UI with `@mastra/playground-ui`: which part to use for a job, why, and how to decide when nothing here covers the case. It ships with the package, so the guidance an app reads always matches the version of the code it installed.

The tokens and components define what exists. These files define when to use what. A picture of one page shows what someone decided for that page. These rules are meant to let the next person make a good decision for a page nobody has drawn yet.

## Where each decision lives

Each kind of decision has one source. When a rule here disagrees with the code, the code wins: build from the code and report the rule that drifted.

| Decision                                                    | Source                                                                               |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Token values: colors, text roles, surfaces, motion, spacing | `theme/*.css`, aliased in `theme.css`                                                |
| Which components and variants exist                         | each component's `cva` block or variant map in `src/ds/`                             |
| Which part to use for which job, and why                    | `design/rules/*.md`                                                                  |
| How React code is written                                   | `design/rules/react.md`, and the full set in `.claude/skills/react-best-practices/`  |
| Why a rule exists                                           | `design/decisions/`                                                                  |
| What a machine enforces                                     | `oxlint/` (shipped as `@mastra/playground-ui/oxlint`) and `src/theme-export.test.ts` |
| Who approves a change                                       | the frontend code owners for `packages/playground-ui/` in `.github/CODEOWNERS`       |

Every other copy of this guidance points here. It does not restate it.

## What to read for the job

Every UI change reads `rules/core.md` and `rules/react.md` first.

| Job                                                                     | Then read                                                                                                                       | Check with                                                                                              |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| A new page or route                                                     | the closest shipped page in the same product, `examples/README.md`, `rules/page-frame.md`, `rules/controls.md`, `rules/copy.md` | lint, then the page in a browser at desktop and mobile width, both themes, every state it can reach     |
| A new or changed `src/ds/` component                                    | `build-component.md`, `rules/interface.md`                                                                                      | `pnpm --filter ./packages/playground-ui lint typecheck test`, its stories in both themes                |
| Copy only                                                               | `rules/copy.md`                                                                                                                 | the copy lint rules and the mechanics table in `copy.md`                                                |
| Color, a badge, or status                                               | `rules/color-and-status.md`, then `theme/status.css` for real role names                                                        | `node scripts/check-color-usage.mjs --report`, both themes                                              |
| Text and type                                                           | `rules/text.md`, then `theme/typography.css`                                                                                    | the `text-role` and `txt-tone` lint rules                                                               |
| Charts, or a page that is mostly charts (metrics, observability, usage) | `rules/charts.md`, `examples/pages/requests-dashboard.tsx`                                                                      | loading, updating, empty, and error each keep every card's size; the range and filters survive a reload |
| A data table or list                                                    | "Tables and lists" in `rules/page-frame.md`, `examples/pages/usage-dashboard.tsx`                                               | keyboard path through rows; loading rows match the ready row count                                      |
| Motion                                                                  | `src/ds/primitives/transitions.ts`, `theme/motion.css`, section 5 of `build-component.md`                                       | the same interaction with `prefers-reduced-motion: reduce`                                              |
| A form                                                                  | "Forms" in `rules/controls.md`, `examples/pages/create-project.tsx`                                                             | submit empty, fix one field, submit again                                                               |

## When nothing here covers the case

Work down this list and stop at the first step that answers it.

```text
1. Does the installed code already decide it?             -> follow the code; report the rule that drifted
2. Is there a shipped page in the same product doing the
   same job, not reverted or superseded since?            -> match it, and name it in the PR
3. Can you name the rule the closest example follows?     -> apply that rule, not the example's look
4. Does a variant, size, tone, slot, or composition of
   existing parts express it?                             -> use that
5. None of these                                          -> stop. Propose a variant or component to a
                                                             frontend code owner, with two real call sites.
                                                             Do not style around it.
```

Write the decision in the PR description in one sentence. A good call that leaves no trace has to be made again by the next person.

## How a rule changes

1. Open a PR that changes the rule and adds a note in `decisions/`, following `decisions/README.md`: the decision, its scope, why, the evidence, and what it replaced.
2. A frontend code owner who did not write the proposal approves it. The same review covers the design decision and the code.
3. When a value or API changes, the code and the rule change in the same PR. The rule never describes code that has not merged.
4. Fix every copy of the old rule in the same PR, then run the note's `Reaches` command and check each place it lands. Tokens change every screen at once; usage does not.

A rule names what two screens share, not what they look like. If the only reason to copy a pattern is that two screens look alike, it is not a rule yet.

## How to check your own work

| Check                                                                                       | Catches                                                                                                                                 | Runs in CI               |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `@mastra/playground-ui/oxlint`                                                              | raw text sizes, `Txt` ink classes, `font-mono`, barrel imports, icon button sizes, placeholders, separators and repeated spaces in copy | yes, through `pnpm lint` |
| `src/theme-export.test.ts` and the export tests                                             | the token contract, contrast floors, the TypeScript mirrors, the published surface                                                      | yes                      |
| `scripts/check-color-usage.mjs --report`                                                    | legacy and foundation color tokens                                                                                                      | no, run it by hand       |
| Storybook (`pnpm --filter ./packages/playground-ui storybook`) with the a11y and MCP addons | every variant and state, both themes, a11y violations                                                                                   | no, run it locally       |
| A browser pass on the real route                                                            | everything above misses                                                                                                                 | no                       |

Lint does not catch a class that names no token, such as a misspelled role. It renders nothing and raises no error, so check every role and color name against `theme/`.

To test the guidance itself, give a fresh agent only this repository and ask for a page nobody has designed, such as "an index of evaluation runs in Studio with filters." Every choice it invents is a missing rule. Fix the rule, not just the page. The same goes for review: when a reviewer flags something on a rendered page, ask which rule would have prevented it, then fix the page, change or add that rule, and record the call in `decisions/`. Decisions 0004 to 0006 came from one review of `examples/pages/billing-overview.tsx`.

## Files

- `rules/core.md`: no restyling, no arbitrary values, build from design-system parts
- `rules/react.md`: how components, pages, and hooks are written
- `rules/page-frame.md`: the app shell, page width and header, actions, page body, page states
- `rules/controls.md`: text entry, choices, forms, buttons
- `rules/color-and-status.md`: status, badges, the color tree, opacity
- `rules/text.md`: text roles and monospace
- `rules/copy.md`: when words are allowed, where they go, how they read, error messages
- `rules/charts.md`: which chart, the chart card, chart colors, dense data pages, chart states
- `rules/interface.md`: shared behavior and component props
- `build-component.md`: adding a component to `src/ds/`
- `examples/`: whole pages to copy
- `decisions/`: why each rule exists
