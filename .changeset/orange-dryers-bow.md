---
'@mastra/playground-ui': minor
---

Added a shared composable `Plan` component for rendering markdown plan previews with status, copy, action slots, and collapsed-content controls.

```tsx
import { Plan } from '@mastra/playground-ui/components/Plan';

<Plan>
  <Plan.Header>
    <Plan.Label />
    <Plan.HeaderActions>
      <Plan.CopyButton content={planMarkdown} />
    </Plan.HeaderActions>
  </Plan.Header>
  <Plan.Body>
    <Plan.Intro>
      <Plan.Title>Review migration plan</Plan.Title>
      <Plan.Path>/workspace/.mastracode/plans/migration.md</Plan.Path>
    </Plan.Intro>
    <Plan.Main>
      <Plan.Content>{planMarkdown}</Plan.Content>
      <Plan.Controls />
    </Plan.Main>
  </Plan.Body>
</Plan>;
```
