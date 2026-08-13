---
'@mastra/playground-ui': minor
---

Improved process step indicators with theme-aware status colors and a plain embedded style.

**Added a `plain` variant to `ProcessStepListItem`** — for step lists that already sit inside a panel, where the boxed active card is one frame too many:

```tsx
<ProcessStepListItem step={step} isActive={step.status === 'running'} position={1} variant="plain" />
```

**Step labels now come from `title`.** The component used to build its label from the step id and ignore the `title` you passed, so display copy had to live in kebab-case ids:

```tsx
const step = { id: 'clone-repo', title: 'Cloning repository', status: 'running', description: '' };

<ProcessStepListItem step={step} isActive position={1} />;
// before: "Clone repo"
// after:  "Cloning repository"
```

Two pieces of API went away with it: the `stepId` prop (it always duplicated `step.id`) and `ProcessStep.isActive` (the active step is passed to the item, or derived from `currentStep` by `ProcessStepList`). Drop `stepId` from your call sites and `isActive` from the step objects you build.
