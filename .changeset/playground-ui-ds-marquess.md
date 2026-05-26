---
'@mastra/playground-ui': patch
---

Design-system additions to support theming and icon-only actions:

- Added new `IconButton` component for icon-only buttons with required tooltip, `variant` (`default`, `light`, `outline`, `ghost`, `primary`), and form-element sizing.
- `Avatar` now accepts optional `color` and `textColor` props for per-instance tinting, and falls back to the initial when the image fails to load.
- `Searchbar` accepts an optional `className` to let consumers tune layout without forking.
- `TabList` accepts a `style` prop and the active-tab indicator now reads from the `--tab-indicator-color` CSS variable, letting parents theme the indicator (e.g. per-agent accent color).
- `stringToColor` now accepts any `number` for the `lightness` argument and defaults to `90` instead of `75` for a lighter fallback chip.
- Global `body` rule enables `font-smoothing` / `-webkit-font-smoothing` for crisper UI text.
