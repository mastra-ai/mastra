---
'@mastra/playground-ui': patch
---

Added live updates to the Spans and Threads lists. While a rolling time range is selected (for example "Last 24 hours"), new spans and threads, and threads that receive new traces, now appear every 30 seconds without reloading the page. Polling stops for custom past ranges and while the tab is hidden.

The list sources and polling helpers are exported so other apps can reuse them:

```tsx
import { useSpansListSource } from '@mastra/playground-ui/domains/spans/hooks';
import { useThreadsListSource } from '@mastra/playground-ui/domains/threads/hooks';

const { spans, hasNextPage, setEndOfListElement } = useSpansListSource({ query, rolling: true });
const { threads } = useThreadsListSource({ query: threadQuery, rolling: true });
```

`useListHeadPoll`, `mergeHeadRows` and the shared polling constants are exported from `@mastra/playground-ui/domains/observability` for building live lists on other resources.
