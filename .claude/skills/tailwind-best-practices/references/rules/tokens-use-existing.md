---
title: Use Existing Tokens from theme.css
impact: CRITICAL
impactDescription: Ensures visual consistency, enables global updates
tags: tokens, design-tokens, tailwind, colors, spacing, consistency
---

## Use Existing Tokens from theme.css

Only use shared design values defined in `packages/playground-ui/theme.css`. Tailwind v4 reads the `@theme` block in that file and turns theme variables into utility APIs such as `bg-surface4`, `text-neutral6`, `p-3`, and `rounded-md`.

**Theme-token decision tree:**

1. Prefer a generated utility from `theme.css` (`bg-surface4`, `text-neutral6`, `h-form-md`, `shadow-dialog`).
2. If a runtime-only value is local to one component, use a regular CSS custom property and Tailwind v4 shorthand (`bg-(--local-color)`) instead of adding a global theme token.
3. If a value should become a shared utility, update `theme.css` only when the task explicitly includes a design-system token change.

**Incorrect (using non-token values):**

```tsx
// DON'T: Using arbitrary hex colors
<div className="bg-[#1a1a1a] text-[#939393]">Content</div>

// DON'T: Using non-standard spacing
<div className="p-[13px] m-[7px]">Content</div>

// DON'T: Using arbitrary font sizes
<span className="text-[15px]">Text</span>

// DON'T: Adding a global @theme value for one component's local state
// packages/playground-ui/theme.css
@theme {
  --color-one-off-tooltip-bg: oklch(20% 0 0);
}
```

**Correct (using design tokens):**

```tsx
// DO: Use token-based colors
<div className="bg-surface4 text-neutral3">Content</div>

// DO: Use token-based spacing
<div className="p-3 m-2">Content</div>

// DO: Use token-based font sizes
<span className="text-ui-md">Text</span>

// DO: Use a local CSS variable when the value should not become a global utility
<div className="bg-(--data-list-sticky-header-background)">Content</div>
```

**Token reference locations:**

- Tailwind v4 theme tokens: `packages/playground-ui/theme.css`
- Token exports used by the package: `packages/playground-ui/src/ds/tokens/*.ts`

**Review smells:**

- Adding a new `--color-*`, `--spacing-*`, `--radius-*`, `--shadow-*`, or `--animate-*` token for a single component state
- Using raw `var(--surface4)` in JSX where the generated `bg-surface4` utility exists
- Reading Tailwind tokens through JavaScript config or `resolveConfig`; use CSS variables or `getComputedStyle` when JavaScript needs a resolved value
