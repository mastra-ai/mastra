---
'@mastra/playground-ui': patch
---

Added a `global` option to `useDataListKeyboard` / `useTableKeydown`. When enabled, ArrowUp/ArrowDown/PageUp/PageDown move the list selection from anywhere on the page, without first focusing a row. Keys typed into inputs, comboboxes, menus or open dialogs are left untouched. Enable it on the single main list of a page:

```ts
const { containerRef, getRowProps } = useDataListKeyboard({ count: items.length, global: true });
```

Studio list pages (agents, tools, workflows, MCP servers, processors, prompts, scorers, datasets, experiments, schedules, inbox, skills, logs, traces) now use it, so pressing ArrowUp/ArrowDown moves the selection right away without having to click or tab into the list first.
