---
name: playground-ui-styling
description: Design-system styling policy for Mastra Playground UI. This skill should be used when writing, reviewing, or refactoring UI code in packages/playground-ui and packages/playground to ensure design system consistency. Triggers on tasks involving components, Tailwind classes, or design tokens in those packages.
---

# Playground UI Styling

Design-system policy for `packages/playground-ui` and `packages/playground`. For Tailwind v4 mechanics (renames, dynamic utilities, CSS-first APIs), read the `tailwind-v4` skill.

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
