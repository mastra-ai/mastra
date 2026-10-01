---
name: diffs
description:
  Use when an app uses @pierre/diffs to render or edit code files, diffs,
  patches, merge conflicts, or CodeView review surfaces, including React,
  vanilla JavaScript, SSR, workers, annotations, selection, and custom Shiki
  languages or themes.
---

# `@pierre/diffs`

Use `@pierre/diffs` to render syntax-highlighted files and diffs. Use its
optional editor, SSR, and worker entries for those capabilities.

For standalone HTML or token generation with `@pierre/highlights`, read the
[highlights skill](../highlights/SKILL.md).

## Install

```bash
pnpm add @pierre/diffs
```

Install `react` and `react-dom` when the app uses the React entry.

## Select an API reference

| Surface                                                      | Reference                                              |
| ------------------------------------------------------------ | ------------------------------------------------------ |
| Root components, parsing, and file extension APIs            | [Core API](references/api-core.md)                     |
| Languages, themes, highlighter state, and streams            | [Highlighting API](references/api-highlighting.md)     |
| Renderers, managers, DOM helpers, comparisons, and constants | [Low-level rendering API](references/api-rendering.md) |
| Shared data, option, render, selection, and editor types     | [Shared types](references/api-types.md)                |
| `@pierre/diffs/react`                                        | [React API](references/api-react.md)                   |
| `@pierre/diffs/edit`                                         | [Editor API](references/api-editor.md)                 |
| `@pierre/diffs/ssr`                                          | [SSR API](references/api-ssr.md)                       |
| `@pierre/diffs/worker` and worker scripts                    | [Worker API](references/api-worker.md)                 |

## Select a recipe

| Task                                | Recipe                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------ |
| Render a file or diff in React      | [Render with React](references/recipe-react.md)                          |
| Render a file or diff without React | [Render with vanilla JavaScript](references/recipe-vanilla.md)           |
| Build a virtualized review surface  | [Use CodeView](references/recipe-code-view.md)                           |
| Edit a React surface or CodeView    | [Edit with React](references/recipe-edit-react.md)                       |
| Edit a vanilla surface or CodeView  | [Edit with vanilla JavaScript](references/recipe-edit-vanilla.md)        |
| Preload markup on the server        | [Use SSR](references/recipe-ssr.md)                                      |
| Highlight through a worker pool     | [Use workers](references/recipe-workers.md)                              |
| Add line annotations and selection  | [Add annotations and selection](references/recipe-annotations.md)        |
| Register a Shiki language or theme  | [Register custom highlighting](references/recipe-custom-highlighting.md) |
