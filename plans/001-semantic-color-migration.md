# Semantic color migration

## Goal

Move grayscale, black, white, and neutral alpha usage onto a two-layer color system:

1. Immutable foundation values in `theme.css`.
2. Component-facing semantic roles in `new-theme.css`.

The semantic layer is opt-in. Shipping or importing `@mastra/playground-ui/theme.css` must not change existing production UI.

## Contract

`@mastra/playground-ui/new-theme.css` contains the semantic variables, inline Tailwind mappings, and semantic utility source. It is not imported by `theme.css` or the global production `style.css` bundle.

The initial contract has these roles:

| Role               | Dark and light foundation                 |
| ------------------ | ----------------------------------------- |
| `background`       | `background-2`                            |
| `sidebar`          | `background-1`                            |
| `card`             | `background-3`                            |
| `popover`          | `background-3`                            |
| `muted`            | `gray-1`                                  |
| `foreground`       | `gray-10`                                 |
| `muted-foreground` | `gray-9`                                  |
| `border`           | dark `gray-alpha-2`, light `gray-alpha-3` |
| `ring`             | `gray-8`                                  |
| `sidebar-accent`   | `gray-alpha-1`                            |

Add roles only when a component demonstrates a state that the current contract cannot represent. SidebarNew adds `selected` at `gray-alpha-2` for its persistent navigation state.

## Opt-in rules

A migration must explicitly enable the semantic layer. Choose the narrowest option that fits the consumer:

- Applications import `@mastra/playground-ui/new-theme.css` alongside the existing Playground UI styles.
- A separately exported component root may import `new-theme.css` directly when using that component must enable the semantic layer.
- Storybook imports `new-theme.css` so the contract and migrated components can be reviewed without changing production consumers.

Migrated JSX uses canonical semantic utilities such as `bg-background`, `bg-card`, `text-foreground`, and `border-border`. Do not replace them with Tailwind custom-property utilities such as `bg-(--background)` or inline arbitrary declarations such as `[--neutral3:var(--muted-foreground)]`.

When a migrated component wraps a legacy primitive, keep any temporary compatibility aliases under the component's opt-in class in `new-theme.css`. Do not expose that bridge in JSX or change the shared primitive for unrelated consumers.

## Guardrails

- Migrate neutral colors only. Chromatic roles move in a later project.
- Do not change typography, spacing, sizing, radius, shadow, motion, behavior, markup, or public APIs as part of a color migration.
- Components use semantic roles, never raw `background-*`, `gray-*`, or `gray-alpha-*` foundations.
- Existing public tokens remain compatibility aliases until first-party usage reaches zero.
- Do not commit a generated color usage baseline.
- Do not add color enforcement to package test, lint, or CI scripts during the exploratory migration.
- Merge each dependency before starting the next migration branch.
- Keep each component migration to one Linear issue and one pull request.

## Scoped report

Use the report to inventory a migration target and provide review evidence:

```bash
node packages/playground-ui/scripts/check-color-usage.mjs --report \
  --root packages/playground-ui/src/path/to/component
```

Use `--component <name>` when the target spans configured roots. The report covers legacy utilities, direct CSS variables, TypeScript token access, foundation references, semantic references, and achromatic literals. It is informational and manually invoked.

## Component workflow

For each target:

1. Run the scoped report and record the production call sites.
2. Map every visual state to an existing semantic role.
3. Add a role only when an approved state has no accurate role.
4. Choose the narrowest explicit opt-in point.
5. Replace neutral styling with canonical semantic utilities.
6. Keep legacy primitive aliases under a scoped opt-in class when they are still required.
7. Confirm the scoped report has no remaining legacy or direct foundation references in production files.
8. Run focused tests, the full package tests, typecheck, build, lint, Prettier, and anti-slop.
9. Verify computed styles and behavior in dark and light themes.
10. Capture matching screenshots and obtain localhost approval before pushing.

## Rollout order

1. Foundation scale: MASTRA-4601, merged in PR #23995.
2. Opt-in semantic contract and scoped report: MASTRA-4606, merged in PR #24032.
3. SidebarNew pilot: MASTRA-4607, PR #24062, with the direct component-root import refined in stacked PR #24151.
4. Studio shell migration, created just in time after the pilot merges.
5. AppShell migration, created after the Studio shell merges.
6. Remaining components, one issue and pull request at a time, ordered by scoped report size and migration risk.

The Platform SidebarNew backport remains separate. It starts only after the Playground UI change is released as a package version that Platform can consume.

## Completion criteria

The migration is complete when:

- First-party components use semantic roles for neutral styling.
- Every migrated consumer opts into the semantic layer explicitly.
- No first-party production call site uses legacy neutral tokens or direct neutral foundations.
- Compatibility aliases can be removed without changing rendered output.
- The global `theme.css` and `style.css` entry points remain stable until a separately approved default-theme transition.
