---
'@mastra/playground-ui': minor
---

Added a shared composable `Plan` component for rendering markdown plan previews with status, copy, action slots, and collapsed-content controls.

```tsx
import {
  Plan,
  PlanBody,
  PlanContent,
  PlanControls,
  PlanCopyButton,
  PlanHeader,
  PlanHeaderActions,
  PlanIntro,
  PlanLabel,
  PlanMain,
  PlanPath,
  PlanTitle,
} from '@mastra/playground-ui/components/Plan';

<Plan>
  <PlanHeader>
    <PlanLabel />
    <PlanHeaderActions>
      <PlanCopyButton content={planMarkdown} />
    </PlanHeaderActions>
  </PlanHeader>
  <PlanBody>
    <PlanIntro>
      <PlanTitle>Review migration plan</PlanTitle>
      <PlanPath>/workspace/.mastracode/plans/migration.md</PlanPath>
    </PlanIntro>
    <PlanMain>
      <PlanContent>{planMarkdown}</PlanContent>
      <PlanControls />
    </PlanMain>
  </PlanBody>
</Plan>;
```
