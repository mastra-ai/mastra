# `@pierre/theme` API reference

This reference lists every public package entry.

## Main entry

| Import          | Export       | Purpose                                     |
| --------------- | ------------ | ------------------------------------------- |
| `@pierre/theme` | `themeNames` | Lists the ten theme names in package order. |

## Theme entries

Each entry has one default export. The export is an immutable Pierre theme
object.

| Import                                               | Theme name                             | Color scheme | Purpose                                              |
| ---------------------------------------------------- | -------------------------------------- | ------------ | ---------------------------------------------------- |
| `@pierre/theme/pierre-light`                         | `pierre-light`                         | Light        | Supplies the standard light theme.                   |
| `@pierre/theme/pierre-dark`                          | `pierre-dark`                          | Dark         | Supplies the standard dark theme.                    |
| `@pierre/theme/pierre-light-soft`                    | `pierre-light-soft`                    | Light        | Supplies the soft light theme.                       |
| `@pierre/theme/pierre-dark-soft`                     | `pierre-dark-soft`                     | Dark         | Supplies the soft dark theme.                        |
| `@pierre/theme/pierre-light-vibrant`                 | `pierre-light-vibrant`                 | Light        | Supplies the Display-P3 light theme.                 |
| `@pierre/theme/pierre-dark-vibrant`                  | `pierre-dark-vibrant`                  | Dark         | Supplies the Display-P3 dark theme.                  |
| `@pierre/theme/pierre-light-protanopia-deuteranopia` | `pierre-light-protanopia-deuteranopia` | Light        | Supplies the light red-green color-vision variant.   |
| `@pierre/theme/pierre-dark-protanopia-deuteranopia`  | `pierre-dark-protanopia-deuteranopia`  | Dark         | Supplies the dark red-green color-vision variant.    |
| `@pierre/theme/pierre-light-tritanopia`              | `pierre-light-tritanopia`              | Light        | Supplies the light blue-yellow color-vision variant. |
| `@pierre/theme/pierre-dark-tritanopia`               | `pierre-dark-tritanopia`               | Dark         | Supplies the dark blue-yellow color-vision variant.  |

## Raw theme entries

`@pierre/theme/themes/*` exposes each generated JSON file. Replace `*` with a
theme file name, including `.json`.

## Theme object

Each default export has these immutable fields:

| Field                 | Purpose                                        |
| --------------------- | ---------------------------------------------- |
| `name`                | Provides the stable theme identifier.          |
| `displayName`         | Provides the label for a theme selector.       |
| `type`                | Identifies the `light` or `dark` color scheme. |
| `colors`              | Maps VS Code workbench color keys to colors.   |
| `tokenColors`         | Defines TextMate token styles.                 |
| `semanticTokenColors` | Defines semantic token styles.                 |
