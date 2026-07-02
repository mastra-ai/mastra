---
name: playground-ui-styling
description: How to build frontend UI with the @mastra/playground-ui design system. This skill should be used when writing, reviewing, or refactoring any frontend application UI that consumes the design system, in this repo or outside it. The docs site has its own styling and is out of scope. Triggers on tasks involving components, Tailwind classes, or design tokens in frontend UI.
---

# Building UI with the Design System

How to consume the `@mastra/playground-ui` design system. Every Mastra frontend application UI builds on it — do not hand-roll product UI outside it. Exception: the docs site, which has its own styling. This skill is for consumers; changing the design system itself (tokens, `ds/` components, variants) is a separate, explicitly-approved task — the rules below keep the boundary. For Tailwind v4 mechanics (renames, dynamic utilities, CSS-first APIs), read the `tailwind-v4` skill.

Note: code inside `packages/playground-ui` outside `ds/` (for example `src/domains/`) is itself a consumer of the `ds/` primitives — these rules apply there too.

## Wiring

- `packages/playground-ui/src/index.css` imports Tailwind and `theme.css`, and declares the dark variant: `@custom-variant dark (&:is(.dark *))`.
- The palette defaults to dark in `:root`; `html.light` flips the semantic variables. Theming is automatic through semantic tokens (`bg-surface4` adapts by itself) — never write `dark:` color overrides on semantic tokens; reserve `dark:` for rare structural differences.
- Build conditional or merged class strings with `cn()` — exported from `@mastra/playground-ui` for consumers, `src/lib/utils.ts` inside the package. Its `twMerge` is extended with the DS scales (`src/lib/tw-merge-config.ts`), so DS utilities like `text-ui-md` merge correctly; importing `twMerge` from `tailwind-merge` directly mis-merges them.

## Decision ladder

Pick the highest rung that fits; each step down needs a reason:

1. **DS component or variant** from `packages/playground-ui/src/ds/components/` (`<Button variant="primary">`).
2. **Generated theme utility** from `packages/playground-ui/theme.css` (`bg-surface4`, `text-neutral6`, `text-ui-md`, `h-form-md`, `shadow-dialog`).
3. **Dynamic v4 utility** when the value maps to the spacing scale (`min-w-100`, `size-6`, `grid-cols-15`).
4. **Local CSS custom property** consumed via shorthand, for runtime values scoped to one component (`bg-(--row-bg)`, `text-(color:--agent-color-fg)`).
5. **Square-bracket arbitrary value** only for a justified one-off (`max-h-[calc(100dvh-3rem)]`).

## Components (CRITICAL)

- Check `packages/playground-ui/src/ds/components/` before building new UI; inspect the actual exports instead of relying on remembered lists.
- Do not add components to `ds/` unless the task explicitly calls for a shared design-system addition.
- Never pass `className` to DS components to override visual styles — use variants and props, or escalate for a new variant. Exception: layout sizing (`h-*`, `w-*`, `max-*`) on components that document it as an extension point, such as `DialogContent` and `PopoverContent`.

## Theme contract (CRITICAL)

- `packages/playground-ui/theme.css` holds the palette in `:root` and the `@theme` mapping that turns it into utilities. Its variables are API: adding one generates utilities every consumer can use.
- Browse the `@theme` block for the generated namespaces before assuming a value is missing: `--color-*` (semantic surfaces/neutrals/accents), `--spacing-*` (including `form-*` control heights), `--text-ui-*`/`--leading-ui-*`, `--radius-*`, `--shadow-*`, `--container-*`, `--breakpoint-*`.
- Never modify `theme.css` or `packages/playground-ui/src/ds/tokens/*.ts` without explicit approval. To request a token: document the use case, explain why a local CSS custom property is not enough, and wait for the design team.
- Runtime-only or single-component values get a plain CSS custom property (which generates no utility) consumed via `bg-(--var)` — not a new `@theme` token.
- When JavaScript needs a theme value, read the CSS variable (`var(--color-surface4)`, `getComputedStyle`) — never `resolveConfig` or JS token imports for styling.

## Review smells

- `bg-[#hex]`, `text-[15px]`, `p-[13px]` — a token or scale value exists
- `bg-[var(--x)]` — use `bg-(--x)`
- `min-w-[400px]` and friends that divide cleanly by 4px — use the scale (`min-w-100`)
- Template-literal class fragments (`` `bg-${tone}-500` ``) — map props to complete strings
- A new `--color-*` or `--animate-*` token added for one component's local state
- `className` on a DS component that changes colors, typography, or spacing
- Decorative animation without `motion-safe:`/`motion-reduce:`
- `dark:` color overrides on semantic tokens — the palette already flips via `html.light`
- `twMerge` imported from `tailwind-merge` or manual string concatenation instead of `cn()`
