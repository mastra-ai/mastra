---
'@mastra/playground-ui': minor
---

Improved the `NoLogsInfo` empty state. It now accepts optional `datePreset`, `dateFrom`, and `dateTo` props to show why no logs match the active range, suggests lowering the logging level, and links to the docs. Calling `<NoLogsInfo />` without props keeps the original copy.
