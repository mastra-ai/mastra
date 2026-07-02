---
name: tailwind-v4
description: Tailwind CSS v4 usage guide and v3-to-v4 differences. This skill should be used when writing, reviewing, or refactoring any Tailwind CSS code in this repo. Triggers on tasks involving Tailwind classes, @theme blocks, CSS-first configuration, or cleanup of v3-era syntax.
---

# Tailwind CSS v4

How to write idiomatic Tailwind v4 and spot v3-era syntax that still compiles but should not appear in new code. The playground packages pin `tailwindcss` 4.2.2: v4.2 features are available (logical properties, `font-features-*`), v4.3+ utilities (`scrollbar-*`, `zoom-*`, `tab-*`) are not.

## CSS-first configuration

Tailwind v4 is configured in CSS, not JavaScript.

| Use                                                                        | Never use (v3-era)                    |
| -------------------------------------------------------------------------- | ------------------------------------- |
| `@import 'tailwindcss'`                                                    | `@tailwind base/components/utilities` |
| `@theme { --color-x: ...; }` for tokens that should generate utilities     | `tailwind.config.ts` for new work     |
| `@utility name { ... }` for custom utilities (works with variants)         | `@layer utilities { .name { ... } }`  |
| `@custom-variant dark (&:is(.dark *))`                                     | JS `plugins` / `addVariant`           |
| `@source "path"` / `@source inline("...")` for extra sources / safelisting | `content` array / `safelist` config   |
| `@variant dark { ... }` to apply a Tailwind variant inside custom CSS      | duplicating media queries / selectors |
| `@reference "app.css"` for `@apply` in scoped styles (Vue, CSS Modules)    | duplicating stylesheet imports        |
| `var(--color-x)` in CSS, `getComputedStyle` in JS                          | `theme()` function, `resolveConfig`   |
| `@config "…"` / `@plugin "…"` only for existing JS-config integrations     | adding new JS configs or plugins      |

`@theme` variables are API: each one emits a native CSS variable AND generates utilities (`--color-*` → `bg-*`/`text-*`/`border-*`/..., `--text-*` → `text-*`, `--shadow-*` → `shadow-*`, `--animate-*` → `animate-*`, `--breakpoint-*` → responsive variants). A plain `:root { --x: ...; }` variable generates nothing — use it for runtime-only values. When a token's value references another variable (`--color-x: var(--y)`), declare it in `@theme inline` so the utility resolves the reference at the declaration site. In custom CSS, `--alpha(var(--color-x) / 50%)` and `--spacing(4)` replace v3 `theme()` math.

## v3 → v4 renames

Bare names shifted one step down the scale, so the v3 spelling silently renders smaller or lighter:

| v3                                | v4                                                                |
| --------------------------------- | ----------------------------------------------------------------- |
| `shadow-sm` / `shadow`            | `shadow-xs` / `shadow-sm`                                         |
| `drop-shadow-sm` / `drop-shadow`  | `drop-shadow-xs` / `drop-shadow-sm`                               |
| `blur-sm` / `blur`                | `blur-xs` / `blur-sm`                                             |
| `rounded-sm` / `rounded`          | `rounded-xs` / `rounded-sm`                                       |
| `outline-none`                    | `outline-hidden` (a11y-safe); `outline-none` now truly removes it |
| `ring` (3px)                      | `ring-3`; the default ring is now 1px `currentColor`              |
| `bg-opacity-50`, `text-opacity-*` | opacity modifier: `bg-black/50`, `text-white/50`                  |
| `bg-gradient-to-r`                | `bg-linear-to-r` (plus new `bg-conic-*`, `bg-radial-*`)           |
| `!bg-red-500` (prefix)            | `bg-red-500!` (suffix)                                            |
| `flex-shrink-*` / `flex-grow-*`   | `shrink-*` / `grow-*`                                             |
| `bg-[--var]`                      | `bg-(--var)`; brackets now require `bg-[var(--var)]`              |
| `grid-cols-[a,b]` (commas)        | underscores: `grid-cols-[max-content_auto]`                       |

## Prefer generated utilities over arbitrary values

The spacing scale is infinite — every number compiles via `calc(var(--spacing) * n)` — so most v3-era arbitrary values have a named form:

| Don't                                  | Do                                                                                      |
| -------------------------------------- | --------------------------------------------------------------------------------------- |
| `min-w-[400px]`, `w-[600px]`           | `min-w-100`, `w-150`                                                                    |
| `h-[1.5rem] w-[1.5rem]`                | `size-6`                                                                                |
| `mt-[68px]`                            | `mt-17`                                                                                 |
| `grid-cols-[repeat(15,minmax(0,1fr))]` | `grid-cols-15`                                                                          |
| `h-[100dvh]`, `w-[100dvw]`, `h-[1lh]`  | `h-dvh`, `w-dvw`, `h-lh`                                                                |
| `max-w-[80rem]`                        | `max-w-7xl` (container scale)                                                           |
| `data-[current]:opacity-100`           | `data-current:opacity-100` (values keep brackets: `data-[state=open]:`)                 |
| `bg-[var(--row-bg)]`                   | `bg-(--row-bg)`; type hints when ambiguous: `text-(color:--fg)`, `text-(length:--size)` |

Square brackets remain correct for true one-offs: `max-h-[calc(100dvh-3rem)]`, `grid-cols-[200px_minmax(0,1fr)]`, and arbitrary properties like `[mask-type:luminance]`.

Class strings must stay complete and statically detectable: map props to full strings (`{ success: 'bg-positive1' }[tone]`), never build fragments like `` `bg-${tone}-500` ``.

## New capabilities — reach for these before hacks or JS

- `field-sizing-content` — auto-growing textarea without a JS resize listener.
- `wrap-anywhere` / `wrap-break-word` — long-word breaking inside flex without the `min-w-0` hack.
- `items-center-safe`, `justify-center-safe` — centering that falls back to `start` on overflow.
- `pointer-coarse:` / `pointer-fine:` — adapt touch targets without user-agent sniffing.
- `user-valid:` / `user-invalid:` — validation styling only after user interaction (unlike `:valid`).
- `starting:` (+ `transition-discrete` for `display`/popover) — enter transitions without JS mount tricks.
- `text-shadow-*`, `mask-t-from-*`/`mask-b-to-*` (fade-out edges), `scheme-dark` (native controls/scrollbars), 3D transforms (`rotate-x-*`, `perspective-*`).

## Behavior changes to remember

- Transforms use individual CSS properties: custom transition lists need `transition-[opacity,scale]`, not `transition-[opacity,transform]`; reset with `scale-none`/`rotate-none`/`translate-none`.
- `hover:` only applies on hover-capable devices (`@media (hover: hover)`) — never gate required touch functionality behind hover.
- Default `border-*`, `divide-*`, ring, and outline colors are `currentColor` — set an explicit color when the color matters.
- Variant stacking applies left to right: v3 `first:*:pt-0` is now `*:first:pt-0`.
- `space-x/y-*` changed selectors (`:not(:last-child)`); prefer flex/grid with `gap-*`.
- Container queries are built in: `@container` on the parent, `@sm:`/`@max-md:` on children.
- Useful v4 variants: `starting:` (enter transitions), `not-*`, `in-*` (like `group-*` without the `group` class), `nth-*`, `*:` (direct children), `**:` (descendants), `inert:`.

## Motion

- Gate decorative animation: `motion-safe:animate-spin motion-reduce:animate-none`.
- Reusable animations are `--animate-*` tokens with their `@keyframes` inside `@theme`; local one-offs use `animate-(--local-animation)` or `animate-[...]`.
