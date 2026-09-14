---
'@mastra/playground-ui': minor
---

Added a composable `ThreadTrace` component for rendering a memory thread as its traces (one row per agent turn, with the messages beside the span tree and a side panel for the selected span). Every part (`ThreadTrace.List`, `.Rail`, `.Row`, `.Messages`, `.Details`, `.DetailsHeader`, `.TabList`, `.Tab`, `.TabContent`, `.SpansTab`, `.SpanPanel`, …) accepts `className` and extra props, and `useThreadTrace` / `useThreadTraceRow` expose the selection, highlight and expansion state so custom tabs and slots can be plugged in from the call site. Also moved the `useExpandedSpanIds` and `useVisibleTraceRows` hooks into the package, and `Tabs` now forwards extra props (such as `data-testid`) to its root element.
