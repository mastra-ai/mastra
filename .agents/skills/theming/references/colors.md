# Colors API

This reference covers every export from `@pierre/theming/color`.

## Exports

| Export                 | Kind     | Purpose                                                        |
| ---------------------- | -------- | -------------------------------------------------------------- |
| `normalizeThemeColors` | Function | Resolves the UI color fallback chains in a `ThemeLike` object. |
| `colorUtils`           | Object   | Groups pure color checks and transforms.                       |

`normalizeThemeColors(theme)` returns a memoized `ThemeLike` object. Use its
`colors` map for the UI around syntax-highlighted code.

## `colorUtils` methods

| Method                                               | Purpose                                                        |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| `relativeLuminance(color)`                           | Calculates WCAG luminance for a hex color.                     |
| `contrastRatio(a, b)`                                | Calculates the contrast ratio between two luminance values.    |
| `compositeOverBg(foreground, background?)`           | Flattens a translucent hex color over a background.            |
| `isFullyTransparent(color?)`                         | Tests whether a hex color has zero alpha.                      |
| `isDarkSurface(background?, foregroundHint?)`        | Classifies a surface as dark or light.                         |
| `surfacesMatch(a?, b?)`                              | Tests whether two hex surfaces produce the same visible color. |
| `hoverWouldEraseText(hover, background, foreground)` | Tests whether a hover surface removes text contrast.           |
| `pickReadableForeground(background, candidates)`     | Selects the candidate with the best readable contrast.         |
| `deriveMutedFg(foreground, background)`              | Derives a muted foreground with readable contrast.             |

The color methods measure hex colors. A method returns its documented empty
result when it cannot measure another CSS color format.
