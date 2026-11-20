---
name: mastra-frontend
description: How to build Mastra frontend interfaces with the @mastra/playground-ui design system. This skill should be used when creating or modifying any application UI — pages, components, styling, or tokens — in this repo or in an external consumer of the design system. The docs site has its own styling and is out of scope.
---

# Building Frontend Interfaces

Every Mastra application UI is assembled from the `@mastra/playground-ui` design system. Building a screen is composition work: pick existing components, arrange them with layout utilities, and let the design system provide the look. Writing colors, font sizes, shadows, or radii by hand means you have left the happy path. Changing the design system itself (tokens, `ds/` components, variants) is a separate, explicitly-approved task. For Tailwind v4 mechanics (renames, dynamic utilities, CSS-first APIs), read the `tailwind-v4` skill.

## The boundary: look vs layout

- **Look** — colors, typography, radius, shadows, borders, internal padding — belongs to the design system. Consumers never restyle it.
- **Layout** — positioning, flex/grid placement, `gap-*`, margins, size constraints (`w-*`, `max-w-*`, `min-h-*`, `shrink-0`) — belongs to the consumer, through Tailwind utilities on your own wrappers and, when needed, directly on DS components.

`className` on a DS component is fine for layout (`<DialogContent size="xl" className="h-[80vh]">`, where `size` picks the width and the class only pins the height) and forbidden for look (`<Button className="bg-red-500 text-xs">`). If a component's look doesn't fit, use its variants and props; if none fit, escalate for a new variant instead of overriding.

## Find what exists — never guess, never rebuild

- **Components**: browse `packages/playground-ui/src/ds/components/` (primitives) and `src/domains/` (feature components). Check the exports and existing usage before building anything new.
- **Tokens**: read the `@theme` blocks under `packages/playground-ui/theme/` (`colors`, `status`, `data-viz`, `surfaces`, `typography`, `scale`, `motion`), all imported by `packages/playground-ui/theme.css`, which holds the semantic aliases. The namespace tells you the generated utility: `--color-x` → `bg-x`/`text-x`/`border-x`, `--spacing-x` → `p-x`/`gap-x`/`h-x`, `--text-x` → `text-x`, `--shadow-x` → `shadow-x`, `--radius-x` → `rounded-x`. Token names drift — confirm them in the file, never use them from memory.

## Choosing a class value

Pick the highest rung that fits; each step down needs a reason:

1. **DS component or variant** — the look you need probably already exists.
2. **Generated theme utility** from `theme.css`.
3. **Dynamic v4 utility** when the value maps to the spacing scale (`min-w-100`, `size-6`, `grid-cols-15`).
4. **Local CSS custom property** consumed via shorthand, for runtime values scoped to one component (`bg-(--row-bg)`, `text-(color:--agent-color-fg)`).
5. **Square-bracket arbitrary value** only for a justified one-off (`max-h-[calc(100dvh-3rem)]`).

## Theme contract

- `theme.css` variables are API: adding one generates utilities for every consumer. Never modify `theme.css`, its layers in `packages/playground-ui/theme/`, or `packages/playground-ui/src/ds/tokens/*.ts` without explicit approval. To request a token: document the use case, explain why a local CSS custom property is not enough, and wait for the design team.
- Runtime-only or single-component values get a plain CSS custom property (which generates no utility) consumed via `bg-(--var)` — not a new `@theme` token.
- When JavaScript needs a theme value, read the CSS variable (`var(--color-surface4)`, `getComputedStyle`) — never `resolveConfig` or JS token imports for styling.

## Wiring

- `packages/playground-ui/components.css` is the design system's stylesheet uncompiled: `theme.css`, the dark variant (`@custom-variant dark (&:is(.dark *))`), custom utilities, base styles and keyframes. `src/index.css` is `@import 'tailwindcss'` plus that file, for the library build. An app with its own Tailwind build imports `components.css` and `sources.css` into its sheet instead of `style.css`.
- The palette defaults to dark in `:root`; `html.light` flips the semantic variables. Theming is automatic through semantic tokens — never write `dark:` color overrides on semantic tokens; reserve `dark:` for rare structural differences.
- Build conditional or merged class strings with `cn()` — exported from `@mastra/playground-ui` for consumers, `src/lib/utils.ts` inside the package. Its `twMerge` is extended with the DS scales (`src/lib/tw-merge-config.ts`), so DS utilities like `text-body-sm` merge correctly; importing `twMerge` from `tailwind-merge` directly mis-merges them.
- Code inside `packages/playground-ui` outside `ds/` (for example `src/domains/`) is itself a consumer of the `ds/` primitives — all of these rules apply there too.

## Settings pages: SettingsRow vs SettingsItem

Settings cards (`@mastra/playground-ui/new/settings`) hold two kinds of rows. Pick by what the row is, not by how it looks:

- **`SettingsRow`** (or `SettingsFieldsetRow` for a group of controls): a setting the person changes. Label, optional one-line description, and the control that changes it (input, select, switch, segmented control). It is a form field: the label names the control. A setting someone may not change keeps `SettingsRow` with `viewOnly`.
- **`SettingsItem`**: one thing in a list (an account, member, session, API key, connection, repository, a package version). Title, optional media and one-line description, and its status or per-item actions (Remove, Revoke, Copy) on the right. Lists usually come from a `.map` and start with a `SettingsListHeader`; an empty list is one `SettingsEmptyRow`.

A row that only shows a value, status or per-item actions is a `SettingsItem`, and so is each record of a list (accounts, keys, versions) even when it comes from a `.map`. A `.map` over settings (one switch per tool) still renders `SettingsRow`s: what matters is whether the row's control changes a setting.

## Review smells

- Look overrides on DS components: `bg-*`, text color or size, border color, `rounded-*`, `shadow-*`, or padding via `className`
- A new component that duplicates an existing `ds/` or `domains/` component
- A `SettingsRow` per list entry or read-only value (versions, members, keys), or a `SettingsItem` wrapping a control that changes a setting: see "Settings pages" above
- `bg-[#hex]`, `text-[15px]`, `p-[13px]` — a token or scale value exists
- Token names that don't exist in `theme.css` (guessed from memory)
- `bg-[var(--x)]` — use `bg-(--x)`
- `min-w-[400px]` and friends that divide cleanly by 4px — use the scale (`min-w-100`)
- Template-literal class fragments (`` `bg-${tone}-500` ``) — map props to complete strings
- A new `--color-*` or `--animate-*` token added for one component's local state
- `dark:` color overrides on semantic tokens — the palette already flips via `html.light`
- `twMerge` imported from `tailwind-merge` or manual string concatenation instead of `cn()`
- Decorative animation without `motion-safe:`/`motion-reduce:`
- A `font-mono` class anywhere outside `packages/playground-ui/src/ds` (lint rejects it): use `<Txt font="mono">` for identifiers, timestamps, and durations, `InlineCode` or `CodeBlock` for code, `tabular-nums` for numbers. `<pre>` and `<code>` are already mono
- Mono on text a person wrote or reads as language (labels, headings, status, prose): mono is for machine identifiers (IDs, hashes, log lines) and time (timestamps and durations). Other numbers, such as counts, costs, and scores, use the body face with `tabular-nums`. KPI values, chart axes, and chart tooltips stay in the body face even for time, so dashboards read in one face. See the Typography section of `packages/playground-ui/README.md`
- Code as plain or mono text, or a hand-styled `<code className="rounded bg-…">`: use `InlineCode` in a sentence and a highlighted `CodeBlock` (with `lang`) for anything longer
- Title Case on a button, link button, menu item, tab, tooltip, or `aria-label` ("Add Persistent Server"): actions use sentence case ("Add persistent server", "Open in Studio"). Capitalize only the first word and proper nouns: brands and products (Mastra, Studio, GitHub, MCP) and plan names ("Upgrade to Team"). Feature names are lowercase ("Edit working memory"). Lint (`mastra/sentence-case-labels`) catches static text; labels built in variables, props, or default values need the same care
- A trailing ellipsis or Title Case in a placeholder ("Search agents...", "Search Issues"): placeholders read like the system search field on macOS and iOS, sentence case with no ending punctuation ("Search agents", "Filter by name"). Only progress text shown in the field keeps its ellipsis ("Loading agents…"). Lint (`playground-ui/placeholder-text`) checks string `placeholder` and `*Placeholder` values
