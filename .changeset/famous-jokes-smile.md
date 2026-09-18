---
'@mastra/playground-ui': patch
---

Added shared breadcrumb bar composition, configurable separators, and semantic breadcrumb colors.

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
