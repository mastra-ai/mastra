---
title: Use Tailwind v4 Escape Hatches Clearly
impact: HIGH
impactDescription: Prevents noisy arbitrary values while still using v4's better dynamic syntax
tags: classname, arbitrary, tailwind, tailwind-v4, css-variables, source-detection
---

## Use Tailwind v4 Escape Hatches Clearly

Do not treat every non-token value as `bg-[...]`, `text-[...]`, or `min-w-[...]`. Tailwind v4 has better options for dynamic numeric utilities, custom properties, and source detection. Use the narrowest escape hatch that keeps the class readable, statically detectable, and aligned with the design system.

**Decision tree:**

1. Use a DS component prop or variant when one exists.
2. Use a generated utility from `packages/playground-ui/theme.css` (`bg-surface4`, `text-neutral6`, `p-3`, `shadow-dialog`).
3. Use v4 dynamic spacing utilities when the value maps cleanly to the spacing scale (`min-w-100` for 400px, `w-150` for 600px, `size-6` for 1.5rem).
4. Use Tailwind v4 custom-property shorthand for local runtime variables (`bg-(--row-bg)`, `border-(--agent-color-bg)`).
5. Use a type hint when shorthand is ambiguous (`text-(color:--agent-color-fg)`, `text-(length:--dynamic-size)`).
6. Use square-bracket arbitrary values only for a one-off exact value or property that cannot be expressed by an existing utility, token, dynamic v4 utility, or local custom property.

**Incorrect:**

```tsx
// DON'T: Arbitrary colors instead of DS color utilities
<div className="bg-[#1a1a1a] text-[#fff]" />

// DON'T: v3-era or verbose CSS variable arbitrary values
<div className="bg-[--surface4]" />
<div className="bg-[var(--surface4)] text-[var(--neutral6)]" />

// DON'T: v3-style arbitrary dimensions when v4 dynamic utilities map cleanly
<aside className="min-w-[400px]" />
<div className="h-[1.5rem] w-[1.5rem]" />

// DON'T: Dynamic partial class names Tailwind cannot reliably detect
<div className={`bg-${tone}-500`} />

// DON'T: Commas as spaces in grid/object arbitrary values
<div className="grid-cols-[max-content,auto]" />
```

**Correct:**

```tsx
// DO: Use DS theme utilities first
<div className="bg-surface4 text-neutral6" />

// DO: Use v4 dynamic spacing utilities for exact scale values
<aside className="min-w-100" />
<div className="size-6" />

// DO: Use v4 custom-property shorthand for local CSS variables
<div className="bg-(--data-list-sticky-header-background)" />
<div className="border-(--agent-color-bg)" />
<span className="text-(color:--agent-color-fg)" />

// DO: Map props to complete class strings
const toneClassName = {
  success: 'bg-positive1 text-surface1',
  warning: 'bg-warning1 text-surface1',
  neutral: 'bg-surface4 text-neutral6',
}[tone];

// DO: Use underscores for spaces inside arbitrary values
<div className="grid-cols-[max-content_auto]" />

// DO: Use a justified one-off arbitrary dimension when no token fits
<div className="max-h-[calc(100dvh-3rem)]" />
```

**Allowed escape hatches:**

- `utility-(--custom-property)` for CSS custom properties
- `utility-(type:--custom-property)` for ambiguous namespaces like `text-*`
- `h-[value]`, `w-[value]`, `min-*`, and `max-*` only when the value does not map to a v4 dynamic spacing, viewport, or container utility
- Arbitrary properties like `[mask-image:...]` only when Tailwind has no built-in utility and the style is local
- `@source inline(...)` only when a class must be generated but cannot appear as a complete source string

**Review smells:**

- `bg-[var(--...)]`, `text-[var(--...)]`, or `border-[var(--...)]`
- Pixel or rem dimensions in square brackets that divide cleanly by the spacing unit, usually 4px / 0.25rem
- Template-literal class fragments such as `` `text-${color}` ``
- Arbitrary values that duplicate existing `theme.css` utilities
- Adding a global token to avoid one local CSS custom property
