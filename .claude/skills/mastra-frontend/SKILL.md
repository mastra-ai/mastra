---
name: mastra-frontend
description: How to build Mastra frontend interfaces with the @mastra/playground-ui design system. This skill should be used when creating or modifying any application UI — pages, components, styling, or tokens — in this repo or in an external consumer of the design system. The docs site has its own styling and is out of scope.
---

# Building Frontend Interfaces

Every Mastra application UI is assembled from the `@mastra/playground-ui` design system. Building a screen is composition work: pick existing components, arrange them with layout utilities, and let the design system provide the look. Writing colors, font sizes, shadows, or radii by hand means you have left the happy path. Changing the design system itself (tokens, `ds/` components, variants) is a separate, explicitly-approved task. For Tailwind v4 mechanics (renames, dynamic utilities, CSS-first APIs), read the `tailwind-v4` skill.

## The boundary: look vs layout

- **Look** — colors, typography, radius, shadows, borders, internal padding — belongs to the design system. Consumers never restyle it.
- **Layout** — positioning, flex/grid placement, `gap-*`, margins, size constraints (`w-*`, `max-w-*`, `min-h-*`, `shrink-0`) — belongs to the consumer, through Tailwind utilities on your own wrappers and, when needed, directly on DS components.

`className` on a DS component is fine for layout (`<DialogContent className="max-w-100">`) and forbidden for look (`<Button className="bg-red-500 text-xs">`). If a component's look doesn't fit, use its variants and props; if none fit, escalate for a new variant instead of overriding.

## Find what exists — never guess, never rebuild

- **Components**: browse `packages/playground-ui/src/ds/components/` (primitives) and `src/domains/` (feature components). Check the exports and existing usage before building anything new.
- **Tokens**: read the `@theme` block in `packages/playground-ui/theme.css`. The namespace tells you the generated utility: `--color-x` → `bg-x`/`text-x`/`border-x`, `--spacing-x` → `p-x`/`gap-x`/`h-x`, `--text-x` → `text-x`, `--shadow-x` → `shadow-x`, `--radius-x` → `rounded-x`. Token names drift — confirm them in the file, never use them from memory.

## Choosing a class value

Pick the highest rung that fits; each step down needs a reason:

1. **DS component or variant** — the look you need probably already exists.
2. **Generated theme utility** from `theme.css`.
3. **Dynamic v4 utility** when the value maps to the spacing scale (`min-w-100`, `size-6`, `grid-cols-15`).
4. **Local CSS custom property** consumed via shorthand, for runtime values scoped to one component (`bg-(--row-bg)`, `text-(color:--agent-color-fg)`).
5. **Square-bracket arbitrary value** only for a justified one-off (`max-h-[calc(100dvh-3rem)]`).

## Theme contract

- `theme.css` variables are API: adding one generates utilities for every consumer. Never modify `theme.css` or `packages/playground-ui/src/ds/tokens/*.ts` without explicit approval. To request a token: document the use case, explain why a local CSS custom property is not enough, and wait for the design team.
- Runtime-only or single-component values get a plain CSS custom property (which generates no utility) consumed via `bg-(--var)` — not a new `@theme` token.
- When JavaScript needs a theme value, read the CSS variable (`var(--color-surface4)`, `getComputedStyle`) — never `resolveConfig` or JS token imports for styling.

## Wiring

- `packages/playground-ui/src/index.css` imports Tailwind and `theme.css`, and declares the dark variant: `@custom-variant dark (&:is(.dark *))`.
- The palette defaults to dark in `:root`; `html.light` flips the semantic variables. Theming is automatic through semantic tokens — never write `dark:` color overrides on semantic tokens; reserve `dark:` for rare structural differences.
- Build conditional or merged class strings with `cn()` — exported from `@mastra/playground-ui` for consumers, `src/lib/utils.ts` inside the package. Its `twMerge` is extended with the DS scales (`src/lib/tw-merge-config.ts`), so DS utilities like `text-ui-md` merge correctly; importing `twMerge` from `tailwind-merge` directly mis-merges them.
- Code inside `packages/playground-ui` outside `ds/` (for example `src/domains/`) is itself a consumer of the `ds/` primitives — all of these rules apply there too.

## Review smells

- Look overrides on DS components: `bg-*`, text color or size, border color, `rounded-*`, `shadow-*`, or padding via `className`
- A new component that duplicates an existing `ds/` or `domains/` component
- `bg-[#hex]`, `text-[15px]`, `p-[13px]` — a token or scale value exists
- Token names that don't exist in `theme.css` (guessed from memory)
- `bg-[var(--x)]` — use `bg-(--x)`
- `min-w-[400px]` and friends that divide cleanly by 4px — use the scale (`min-w-100`)
- Template-literal class fragments (`` `bg-${tone}-500` ``) — map props to complete strings
- A new `--color-*` or `--animate-*` token added for one component's local state
- `dark:` color overrides on semantic tokens — the palette already flips via `html.light`
- `twMerge` imported from `tailwind-merge` or manual string concatenation instead of `cn()`
- Decorative animation without `motion-safe:`/`motion-reduce:`
