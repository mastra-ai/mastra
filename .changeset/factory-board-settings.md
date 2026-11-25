---
'@mastra/playground-ui': minor
---

Added Factory board settings components (phase walkthrough, starts toggle, phase run fields, board map, board settings navigation) under `@mastra/playground-ui/domains/factory`.

```tsx
import { PhaseRunFields, phaseRunFieldsValid } from '@mastra/playground-ui/domains/factory';

<PhaseRunFields
  phaseName={phase.name}
  instructions={phase.instructions}
  goal={phase.goal}
  onInstructionsChange={instructions => updatePhase({ instructions })}
  onGoalChange={goal => updatePhase({ goal })}
/>
<Button disabled={!phaseRunFieldsValid(phase.instructions, phase.goal)}>Save</Button>
```
