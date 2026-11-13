# Mastra design system guidance

This folder tells a person or an agent how to build Mastra UI with `@mastra/playground-ui`: which part to use for a job, why, and how to decide when nothing here covers the case. It ships with the package, so the guidance an app reads always matches the version of the code it installed.

The tokens and components define what exists. These files define when to use what. A picture of one page shows what someone decided for that page. These rules are meant to let the next person make a good decision for a page nobody has drawn yet.

## Where each decision lives

Each kind of decision has one source. When a rule here disagrees with the code, the code wins: build from the code and report the rule that drifted.

| Decision                                                    | Source                                                                                |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Token values: colors, text roles, surfaces, motion, spacing | `theme/*.css`, aliased in `theme.css`                                                 |
| Which components and variants exist                         | each component's props type, imported from `@mastra/playground-ui/components/<Name>`  |
| Which part to use for which job, and why                    | `design/rules/*.md`                                                                   |
| How React code is written                                   | the `react-best-practices` skill (`.claude/skills/react-best-practices/` in `mastra`) |
| Why a rule exists                                           | the rule's own why sentence, and the PR it links                                      |
| What a machine enforces                                     | `@mastra/playground-ui/oxlint`, and the package's own tests in `mastra`               |
| Who approves a change                                       | the frontend code owners for `packages/playground-ui/` in `.github/CODEOWNERS`        |

Every other copy of this guidance points here. It does not restate it.

## What to read for the job

Every UI change reads `rules/core.md` first, and follows the `react-best-practices` skill for its code.

| Job                                                                     | Then read                                                                                                                         | Check with                                                                                              |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| A new page or route                                                     | the closest shipped page in the same product, `examples/README.md`, `rules/page-frame.md`, `rules/controls.md`, `rules/copy.md`   | lint, then the page in a browser at desktop and mobile width, both themes, every state it can reach     |
| A new or changed `src/ds/` component                                    | `build-component.md`, `rules/interface.md`                                                                                        | `pnpm --filter ./packages/playground-ui lint typecheck test`, its stories in both themes                |
| Copy only                                                               | `rules/copy.md`                                                                                                                   | the copy lint rules and the mechanics table in `copy.md`                                                |
| Color, a badge, or status                                               | `rules/color-and-status.md`, then `theme/status.css` for real role names                                                          | `node scripts/check-color-usage.mjs --report`, both themes                                              |
| Text and type                                                           | `rules/text.md`, then `theme/typography.css`                                                                                      | the `text-role` and `txt-tone` lint rules                                                               |
| Charts, or a page that is mostly charts (metrics, observability, usage) | `rules/charts.md`, `examples/pages/requests-dashboard.tsx`                                                                        | loading, updating, empty, and error each keep every card's size; the range and filters survive a reload |
| A data table or list                                                    | "Tables and lists" in `rules/page-frame.md`, `examples/pages/usage-dashboard.tsx`                                                 | keyboard path through rows; loading rows match the ready row count                                      |
| Motion                                                                  | `theme/motion.css`, the `transitions` presets (`@mastra/playground-ui/primitives/transitions`), section 5 of `build-component.md` | the same interaction with `prefers-reduced-motion: reduce`                                              |
| A form                                                                  | "Forms" in `rules/controls.md`, `examples/pages/create-project.tsx`                                                               | submit empty, fix one field, submit again                                                               |

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

Every rule carries its reason in the same place: the rule, one sentence on what breaks without it, its scope and named exceptions, and a link to the PR that decided it. The PR description holds the evidence, the alternatives that lost, and the search that finds every place the rule applies. The code-owner review on that PR is the approval. There is no separate decision log to keep in sync.

To add or change a rule, follow `.claude/skills/design-rules/SKILL.md`. In short:

1. Name the evidence: two independent examples, one costly failure, or an explicit call from a frontend code owner. One reviewer's taste on one PR is not a rule yet.
2. Edit the rule file that owns the topic (the Files list below). Change the existing rule rather than adding an exception somewhere else, and end the rule with a link to your PR.
3. When a value or API changes, change the code and the rule in the same PR. A rule never describes code that has not merged.
4. Fix every copy of the old rule in the same PR, including `examples/`, and search for every place the rule lands. Tokens change every screen at once; usage does not.
5. A frontend code owner who did not write the proposal approves the PR. The same review covers the design call and the code.

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

To test the guidance itself, give a fresh agent only this repository and ask for a page nobody has designed, such as "an index of evaluation runs in Studio with filters." Every choice it invents is a missing rule. Fix the rule, not just the page. The same goes for review: when a reviewer flags something on a rendered page, ask which rule would have prevented it, then fix the page and change or add that rule in the same PR.

## Files

- `rules/core.md`: no restyling, no arbitrary values, build from design-system parts
- `rules/page-frame.md`: the app shell, page width and header, actions, page body, page states
- `rules/controls.md`: text entry, choices, forms, buttons
- `rules/color-and-status.md`: status, badges, the color tree, opacity
- `rules/text.md`: text roles and monospace
- `rules/copy.md`: when words are allowed, where they go, how they read, error messages
- `rules/charts.md`: which chart, the chart card, chart colors, dense data pages, chart states
- `rules/interface.md`: shared behavior and component props
- `build-component.md`: adding a component to `src/ds/`
- `examples/`: whole pages to copy
