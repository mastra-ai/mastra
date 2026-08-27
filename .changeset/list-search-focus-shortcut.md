---
'@mastra/playground-ui': patch
---

Add a Cmd+Shift+F (Ctrl+Shift+F on Windows/Linux) shortcut to `ListSearch` that focuses and selects the search field, so every Studio list page (agents, tools, workflows, MCP servers, processors, schedules, datasets, experiments, ...) can be filtered without reaching for the mouse. Pass `shortcutDisabled` on a secondary `ListSearch` if a page renders two at once.
