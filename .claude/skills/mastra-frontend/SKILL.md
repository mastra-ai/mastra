---
name: mastra-frontend
description: How to build Mastra frontend interfaces with the @mastra/playground-ui design system. This skill should be used when creating or modifying any application UI — pages, components, styling, or tokens — in this repo or in an external consumer of the design system. The docs site has its own styling and is out of scope.
---

# Building Frontend Interfaces

<context>
Every Mastra application UI is assembled from the `@mastra/playground-ui` design system. Building a screen is composition work: pick existing components, arrange them with layout utilities, and let the design system provide the look. Writing colors, font sizes, shadows, or radii by hand leaves the supported path. Changing the design system itself is a separate, explicitly approved task.
</context>

<workflow>

## Before writing UI

1. Inspect `packages/playground-ui/src/ds/components/` and `src/domains/` for an existing component and usage pattern.
2. Inspect `packages/playground-ui/theme.css` for the exact token and whether it is a raw CSS property or an `@theme` utility.
3. Review the relevant Storybook foundation before changing typography, color, spacing, radius, or shadow.
4. Choose the highest applicable rung from the class-value hierarchy below.
5. Verify the result in every affected theme and viewport.

</workflow>

<rules>

## The boundary between look and layout

- **Look** includes colors, typography, radius, shadows, borders, and internal padding. It MUST come from the design system.
- **Layout** includes positioning, flex/grid placement, gaps, margins, and size constraints. Consumers MAY set layout through Tailwind utilities on wrappers and DS components.
- `className` on a DS component MAY control layout, such as `<DialogContent className="max-w-100">`. It MUST NOT override look, such as `<Button className="bg-red-500 text-xs">`.
- If an existing variant does not fit, the agent MUST escalate for a shared variant instead of locally restyling the component.

## Choosing a class value

Use the first rung that fits:

1. DS component or variant.
2. Generated utility from the `@theme` block in `theme.css`.
3. Dynamic Tailwind v4 utility when the value belongs to the spacing or sizing scale.
4. Local CSS custom property for a runtime value scoped to one component, consumed with syntax such as `bg-(--row-bg)`.
5. Square-bracket arbitrary value only for a justified one-off that has no token or scale value.

Class strings MUST remain complete and statically detectable. Use `cn()` for conditional or merged classes. Do not import `twMerge` directly from `tailwind-merge`.

## Typography

- `text-ui-*` and `text-header-*` are the typography foundation. `Txt` is a convenience component that consumes those tokens; it is not a separate scale.
- Product copy SHOULD use an existing `Txt` variant. Low-level primitives MAY use the foundation utilities directly. Do not add a `Txt` variant for a one-off role.
- UI code MUST NOT use Tailwind size utilities from `text-xs` through `text-4xl` or arbitrary pixel sizes such as `text-[11px]`.
- Each typography token includes its paired line-height. Consumer code MUST NOT add a separate `leading-*` unless the design system explicitly defines an exception.
- Headings MUST follow this hierarchy:

| Role            | Token       |
| --------------- | ----------- |
| Page heading    | `header-md` |
| Hero heading    | `header-xl` |
| Section heading | `header-sm` |
| Panel heading   | `ui-md`     |

Review `Tiger Team/Foundations/Typography` in Storybook before changing typography tokens, `Txt`, or heading conventions. The paired size and line-height are one contract.

## Color foundations and semantics

- Every variable shipped in `theme.css` is part of the CSS contract. Only variables declared in `@theme` generate Tailwind utilities.
- Plain `:root` variables are raw foundations. Adding `--gray-1` does not create `bg-gray-1`.
- Background foundations describe structural nesting:
  - `background-1`: sidebar or outer chrome.
  - `background-2`: main canvas.
  - `background-3`: cards and panels.
- Gray foundations describe contrast strength, not lightness. `gray-1` is subtle and `gray-10` is strong. The tonal direction reverses between themes so the same gray step preserves its role.
- Gray alpha follows the same strength rule. Dark mode uses white overlays and light mode uses black overlays.
- Consumer components MUST use semantic color utilities when they exist. Raw foundations MUST NOT replace existing semantic or legacy tokens outside an explicitly approved migration.
- A new semantic alias MUST name a role, not a visual value. Prefer `sidebar-background` over `dark-gray`.
- Theme-aware tokens MUST switch through `:root` and `html.light`. Components MUST NOT add `dark:` color overrides for behavior already represented by a token.

Review `Tiger Team/Foundations/Color` in Storybook before changing color foundations, semantic aliases, or theme mappings.

## Theme and token wiring

- `packages/playground-ui/src/index.css` imports Tailwind and `theme.css` and declares the dark variant.
- When JavaScript needs a theme value, read the CSS variable. Do not use `resolveConfig` or JavaScript token imports for styling.
- Code inside `packages/playground-ui` but outside `ds/` is a consumer of the design system and MUST follow the same rules.
- For Tailwind v4 mechanics, load the `tailwind-v4` skill.

</rules>

<quality-checklist>

- Existing DS components and variants were checked before new UI was built.
- Typography uses the foundation scale directly or through an existing `Txt` variant, with paired leading intact.
- Raw color foundations, generated utilities, and semantic aliases are not confused.
- The same semantic or gray token is used in both themes without component-level theme overrides.
- No guessed token names, raw colors, arbitrary font sizes, or look overrides appear in consumer code.
- Light and dark themes and relevant viewport widths were verified.

</quality-checklist>
