---
name: theming
description:
  Use when an app uses @pierre/theming to list, resolve, select, switch,
  persist, or apply themes, including color modes, theme controllers, React
  state, UI colors, and bundled Pierre or Shiki collections.
---

# `@pierre/theming`

Use `@pierre/theming` to manage runtime themes. The package separates theme
metadata, theme resolution, selected state, and UI color mapping.

## Install

```bash
pnpm add @pierre/theming
```

Install optional peer dependencies only for the selected entry. The React entry
needs `react`. The themes entry needs `@pierre/theme`, `@shikijs/themes`, and
`shiki`.

## Select an API reference

| Need                                                           | Reference                                    |
| -------------------------------------------------------------- | -------------------------------------------- |
| Create a collection, catalog, descriptor, or bundled theme set | [Collections API](references/collections.md) |
| Register, load, seed, or cache theme objects                   | [Resolver API](references/resolver.md)       |
| Track the color mode and selected light and dark themes        | [Controller API](references/controller.md)   |
| Normalize workbench colors or derive colors                    | [Colors API](references/colors.md)           |
| Read controller state in React                                 | [React API](references/react.md)             |

## Select a controller recipe

| Situation                                                                    | Recipe                                                                |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| One app or page shares one color mode and one light/dark selection           | [Use one controller](references/recipe-one-controller.md)             |
| Independent areas need separate selections or separate controller lifecycles | [Use multiple controllers](references/recipe-multiple-controllers.md) |

Use one controller by default. Use multiple controllers only when the theme
state must differ between areas.

## Select a framework recipe

| Host                                    | Recipe                                                 |
| --------------------------------------- | ------------------------------------------------------ |
| Vanilla JavaScript or another framework | [Use vanilla JavaScript](references/recipe-vanilla.md) |
| React                                   | [Use React](references/recipe-react.md)                |
