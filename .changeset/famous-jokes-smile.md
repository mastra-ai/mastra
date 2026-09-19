---
'@mastra/playground-ui': patch
---

Added shared breadcrumb composition, configurable separators, an optional AppShell page-header slot, and semantic colors across the new layout components.

```tsx
import { Breadcrumb, Crumb } from '@mastra/playground-ui/components/Breadcrumb';

<Breadcrumb.Bar separator="chevron" actions={<button type="button">Deploy</button>}>
  <Breadcrumb.Item pathname="/projects">
    <Crumb as="span">Projects</Crumb>
  </Breadcrumb.Item>
  <Breadcrumb.Item pathname="/projects/production">
    <Crumb as="span" isCurrent action={<button type="button" aria-label="Switch project">Switch</button>}>
      Production project
    </Crumb>
  </Breadcrumb.Item>
</Breadcrumb.Bar>;
```

```tsx
import { AppShell } from '@mastra/playground-ui/new/layout/app-shell';
import { PageHeader } from '@mastra/playground-ui/new/layout/page-header';

<AppShell
  mainLabel="Project content"
  pageHeader={
    <PageHeader>
      <PageHeader.Title>Production project</PageHeader.Title>
    </PageHeader>
  }
>
  <ProjectContent />
</AppShell>;
```
