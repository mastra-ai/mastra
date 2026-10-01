---
name: theme
description:
  Use when an app needs a Pierre light or dark theme from @pierre/theme for
  Shiki, VS Code, Cursor, or Zed, including soft, vibrant, protanopia,
  deuteranopia, and tritanopia variants.
---

# `@pierre/theme`

Use `@pierre/theme` for Pierre syntax and editor themes. The package supplies
ten immutable Shiki and VS Code theme objects.

For Zed-compatible themes used by `@pierre/highlights`, read the
[highlights skill](../highlights/SKILL.md).

## Install

```bash
pnpm add @pierre/theme
```

## Select an API reference

| Need                                    | Reference                                |
| --------------------------------------- | ---------------------------------------- |
| List every package entry and export     | [API reference](references/api.md)       |
| Compare all themes and select a variant | [Theme variants](references/variants.md) |

## Select a recipe

| Task                                | Recipe                                                  |
| ----------------------------------- | ------------------------------------------------------- |
| Load a Pierre theme in Shiki        | [Use a theme with Shiki](references/recipe-shiki.md)    |
| Install a Pierre theme in an editor | [Use a theme in an editor](references/recipe-editor.md) |

Use the `theming` skill when the app must switch themes at runtime or follow a
color mode.
