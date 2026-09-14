---
'@mastra/playground-ui': minor
---

Adds `TabbedContainer` at `@mastra/playground-ui/new/layout/tabbed-container`. The existing DataList entrypoint still exports the same component.

```tsx
import { TabbedContainer } from '@mastra/playground-ui/new/layout/tabbed-container';

<TabbedContainer defaultTab="overview">
  <TabbedContainer.Panel value="overview" label="Overview">
    <Overview />
  </TabbedContainer.Panel>
  <TabbedContainer.DataList value="runs" label="Runs" columns="1fr">
    {rows}
  </TabbedContainer.DataList>
</TabbedContainer>;
```
