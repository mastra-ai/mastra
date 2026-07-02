---
title: Prefer Modern Tailwind v4 Idioms
impact: HIGH
impactDescription: Keeps new code from copying v3-compatible syntax that v4 made unnecessary
tags: tailwind-v4, migration, dynamic-utilities, variants, arbitrary-values, deprecated
---

## Prefer Modern Tailwind v4 Idioms

Tailwind v4 still accepts some v3-era syntax for compatibility, but new Mastra Playground UI code should use the v4 form when it is clearer. Review old-looking utilities as possible cleanup opportunities, especially when touching nearby code.

**Prefer v4 dynamic spacing utilities:**

Tailwind v4 dynamically derives spacing, sizing, margin, padding, width, and height utilities from the spacing scale. If a pixel or rem value maps exactly to the scale, use the generated utility instead of square brackets.

```tsx
// DON'T: v3-style arbitrary dimensions for scale values
<aside className="min-w-[400px]" />
<div className="w-[600px]" />
<Logo className="size-[1.5rem]" />
<Panel className="max-w-[80rem]" />
<Viewport className="h-[100dvh]" />

// DO: v4 dynamic utilities
<aside className="min-w-100" />
<div className="w-150" />
<Logo className="size-6" />
<Panel className="max-w-7xl" />
<Viewport className="h-dvh" />
```

Use square brackets for true one-offs like `max-h-[calc(100dvh-3rem)]` or complex tracks like `grid-cols-[200px_minmax(0,1fr)]`, not for every fixed dimension.

**Prefer v4 custom-property shorthand:**

```tsx
// DON'T
<div className="bg-[var(--row-bg)] opacity-[var(--row-opacity)]" />

// DO
<div className="bg-(--row-bg) opacity-(--row-opacity)" />
```

Use type hints for ambiguous namespaces:

```tsx
<span className="text-(color:--agent-color-fg)" />
<span className="text-(length:--dynamic-font-size)" />
```

**Prefer v4 dynamic utilities and variants:**

```tsx
// DON'T: Arbitrary grid count when the v4 numeric utility exists
<div className="grid grid-cols-[repeat(15,minmax(0,1fr))]" />

// DO
<div className="grid grid-cols-15" />

// DON'T: Custom data variants for boolean data attributes
<div data-current className="data-[current]:opacity-100" />

// DO
<div data-current className="data-current:opacity-100" />
```

For data attributes with values, use complete static class strings such as `data-[state=open]:opacity-100`; do not build data variants dynamically.

**Prefer v4 built-ins for common CSS values:**

```tsx
// DON'T
<div className="h-[1lh] w-[100dvw] opacity-[var(--panel-opacity)]" />

// DO
<div className="h-lh w-dvw opacity-(--panel-opacity)" />
```

**Prefer v4 renamed utilities and modifiers:**

```tsx
// DON'T: Deprecated compatibility forms
<button className="!bg-surface4 outline-none shadow-sm rounded" />

// DO: v4 forms
<button className="bg-surface4! outline-hidden shadow-xs rounded-sm" />
```

Common v3-to-v4 replacements:

- `shadow-sm` -> `shadow-xs`
- `shadow` -> `shadow-sm`
- `drop-shadow-sm` -> `drop-shadow-xs`
- `blur-sm` -> `blur-xs`
- `rounded-sm` -> `rounded-xs`
- `rounded` -> `rounded-sm`
- `outline-none` -> `outline-hidden` when you mean to hide the outline
- important prefix `!bg-*` -> suffix `bg-*!`

**Prefer v4 transform and transition behavior:**

```tsx
// DON'T: v3 aggregate transform assumption
<button className="transition-[opacity,transform] hover:scale-105" />

// DO: v4 individual transform property
<button className="transition-[opacity,scale] hover:scale-105" />
```

Use `scale-none`, `rotate-none`, and `translate-none` to reset individual transforms instead of relying on `transform-none` to clear everything.

**Prefer v4 source and config APIs:**

- Use `@source inline(...)` for safelisting instead of a JavaScript config `safelist`.
- Use `@source` for external or monorepo sources instead of a `content` array.
- Use CSS variables or `getComputedStyle` instead of `resolveConfig`.
- Use `@utility` instead of `@layer utilities` for variant-capable custom utilities.

**Review smells:**

- `w-[400px]`, `min-w-[400px]`, `h-[24px]`, `size-[1.5rem]` where the value maps to the spacing scale
- `h-[100dvh]`, `w-[100dvw]`, or `h-[1lh]` where a named v4 utility exists
- `bg-[var(--...)]`, `opacity-[var(--...)]`, `grid-cols-[var(--...)]`
- `grid-cols-[repeat(N,minmax(0,1fr))]` for plain equal columns
- Deprecated important prefix or renamed utility aliases
- `transition-[...,transform,...]` with `scale-*`, `rotate-*`, or `translate-*`
