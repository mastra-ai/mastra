---
name: mastra-frontend
description: How to build Mastra frontend interfaces with the @mastra/playground-ui design system. This skill should be used when creating or modifying any application UI — pages, components, styling, or tokens — in this repo or in an external consumer of the design system. The docs site has its own styling and is out of scope.
---

# Building Frontend Interfaces

<context>
Mastra application UI is composed from `@mastra/playground-ui`. The design system owns how elements look; product code owns how they are arranged. Consistency comes from reusing the same component, typography role, and semantic color for the same job instead of making each screen internally tasteful.
</context>

<workflow>

## 1. Identify the owner

Classify the change before editing:

- **Product composition:** a page or domain surface needs existing components arranged around product data. Stay outside `src/ds/` and do not change visual tokens.
- **Design-system work:** a shared component, variant, or token is missing. Change `src/ds/` or `theme.css` only when that system change was explicitly requested.

If a product task appears to require design-system work, stop and name the missing component or variant. Do not hide the gap with local styling.

## 2. Find the precedent

1. Search `packages/playground-ui/src/ds/components/` for the element.
2. Search `src/domains/` and repository call sites for how it is composed.
3. Open its Storybook story and the relevant foundation story.
4. Start from the closest real usage. Do not recreate a component from its visual description.

## 3. Choose the component

Use this order:

1. An existing domain component that owns the complete interaction.
2. An existing DS component and its documented variant.
3. A composition of DS primitives.
4. A new shared variant, but only after confirming no existing variant represents the role.

A consumer MAY set layout through `className`: placement, grid or flex behavior, gaps, margins, width constraints, height constraints, and shrinking. A consumer MUST NOT use `className` to change color, typography, border treatment, radius, shadow, or a component's internal padding.

Allowed because it changes layout:

```tsx
<DialogContent className="max-w-100" />
```

Forbidden because it replaces the component's look:

```tsx
<Button className="bg-red-500 text-xs" />
```

## 4. Choose typography by role

Do not start with a font size. Identify what the text does:

| Content role                 | Token       |
| ---------------------------- | ----------- |
| Dense metadata or badge text | `ui-xs`     |
| Secondary copy or caption    | `ui-sm`     |
| Form field label             | `ui-smd`    |
| Default body or control text | `ui-md`     |
| Emphasized body text         | `ui-lg`     |
| Panel heading                | `ui-md`     |
| Section heading              | `header-sm` |
| Page heading                 | `header-md` |
| Hero heading                 | `header-xl` |

Then choose the interface:

1. If a DS component owns the text, pass it content and let it own typography.
2. For standalone product copy, use an existing `Txt` variant that matches the role.
3. Inside a low-level primitive, use `text-ui-*` or `text-header-*` directly.
4. If no role matches, identify the missing role before requesting a token or `Txt` variant.

`Txt` is a convenience component that consumes the typography foundation. It is not a separate type scale. Its `title` and `caption` variants also apply semantic weight or color, so use them only when those complete roles match.

Each `text-ui-*` and `text-header-*` utility includes its paired line-height. Consumer code MUST NOT add `leading-*`. Code MUST NOT use Tailwind's default text sizes or arbitrary pixel font sizes.

Review `Foundations/Updated/Typography` before changing typography tokens, `Txt`, or role assignments.

## 5. Map surface hierarchy, then choose color

Draw the nesting before selecting a surface token:

```text
Application shell
├── Sidebar or outer chrome: background-1
└── Main canvas: background-2
    ├── Content placed directly on the canvas: background-2
    └── Contained structural panel: background-3
        └── Content inside the panel: background-3
```

Background numbers describe containment, not brightness or elevation. Follow these rules:

- Sibling surfaces at the same depth use the same background role.
- Text, controls, and ordinary content inherit their containing surface. They do not create another layer.
- Add a panel layer only when the container creates a structural region, such as a docked inspector. Do not wrap sections in panels for decoration.
- A card is a component recipe, not automatically `background-3`. Use its existing variant; cards may blend with the canvas until hover or selection.
- A panel nested inside another panel does not automatically require a fourth shade. Keep the owning component's surface unless the design system defines another structural role.
- Sidebars embedded inside a panel belong to that component's documented variant; they are not automatically `background-1`.
- Dialogs, popovers, menus, and tooltips use their DS component surface. Do not infer their token from app-shell depth.
- Use spacing to separate sections first. Add a border when adjacent surfaces still need a boundary; do not add both a new background and a border by default.

Factory demonstrates this hierarchy with the current semantic tokens:

- `AppShell` uses `surface1` for the outer frame; the desktop sidebar inherits it.
- The mobile `MainSidebar` drawer owns `surface2` because it is an overlay variant, not the desktop shell.
- The main content frame and header use `surface2`.
- Docked workspace and supervisor panels use `surface3`.
- Work-item cards keep their component recipe (`neutral6/5`, then `surface3` on hover) instead of treating every card as a panel.

This is a conceptual match, not foundation wiring. Factory still consumes the legacy semantic tokens until an approved migration maps them to the new foundations.

Then identify whether the task is consuming or defining the system.

### Product and component work

1. Name the role: shell surface, canvas surface, structural panel, component card, text, border, status, or accent.
2. Find the matching semantic `--color-*` token in `theme.css` and confirm an existing usage.
3. Use the generated semantic utility, such as `bg-surface2`, `text-neutral4`, or `border-border1`.
4. If no semantic role exists, report the missing role. Do not substitute a raw foundation because it looks close.

Current product code MUST preserve its owning component's semantic surface token until the foundation-to-semantic migration is approved. The hierarchy above is the target model, not permission to use raw `background-*` properties in consumers.

### Foundation work

- `background-1`, `background-2`, and `background-3` encode the shell, canvas, and structural panel layers shown above.
- `gray-1` through `gray-10` encode contrast from subtle to strong, not lightness. Their tonal direction reverses by theme.
- `gray-alpha-*` follows the same strength scale, using white overlays in dark mode and black overlays in light mode.
- These are plain CSS properties. They do not generate Tailwind utilities and MUST NOT replace existing semantic tokens outside an approved migration.

A new semantic alias names a job, such as `sidebar-background`, not an appearance such as `dark-gray`. Review `Foundations/Updated/Color` before changing foundations or aliases.

## 6. Choose a class value

For layout or an approved DS implementation, use the first option that fits:

1. Existing component prop or variant.
2. Generated `@theme` utility.
3. Tailwind v4 spacing or sizing utility.
4. Local CSS property for a runtime value scoped to one component.
5. Arbitrary value only when the value cannot be represented by the system.

Keep class strings complete and statically detectable. Use `cn()` for conditional classes. Load the `tailwind-v4` skill for Tailwind mechanics.

## 7. Verify the system, not one screenshot

1. Compare the result with the closest existing product surface.
2. Check light and dark themes using the same semantic tokens. Do not add component-level `dark:` color fixes for token behavior.
3. Check mobile, tablet, and desktop widths.
4. Exercise keyboard and focus behavior for interactive changes.
5. Run the narrow typecheck, lint, and test commands required by the package.
6. For a UI handoff, show the affected states and themes in screenshots.

</workflow>

<quality-checklist>

- The change reuses the nearest component and composition precedent.
- Every text style was chosen from a content role, not a desired pixel size.
- `Txt` is used as a component interface, not treated as the foundation itself.
- Shell, canvas, and structural panels follow the nesting map; cards keep their component-owned recipes.
- Every color was chosen by semantic role; raw foundations remain inside approved system work.
- Consumer classes affect layout only.
- The same semantic tokens work in both themes without local overrides.
- The relevant product states, themes, and viewport widths were verified.

</quality-checklist>
