---
'@mastra/playground-ui': patch
---

Fixed the JSON search highlight in the trace data panel losing its colors in apps that compile the design system's Tailwind sheet themselves. The highlight stylesheet now reads the `--warning-indicator`, `--warning-subtle` and `--sidebar` tokens directly instead of the `--color-*` theme aliases, which Tailwind only emits when a utility uses them.
