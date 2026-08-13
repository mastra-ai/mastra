---
'@mastra/playground-ui': major
---

Improved process step indicators with theme-aware status colors and a plain embedded style.

**Breaking: `ProcessStepListItem` lost the `stepId` prop, and `ProcessStep` lost `isActive`.** `stepId` always duplicated `step.id`, and the active step is either passed to the item or derived from `currentStep` by `ProcessStepList`:

```tsx
// before
<ProcessStepListItem stepId={step.id} step={step} isActive={isActive} position={1} />;
const step = { id: 'clone-repo', title: 'Cloning repository', status: 'running', description: '', isActive: true };

// after
<ProcessStepListItem step={step} isActive={isActive} position={1} />;
const step = { id: 'clone-repo', title: 'Cloning repository', status: 'running', description: '' };
```

**Breaking: step labels now come from `title`.** The component used to build its label from the step id and ignore the `title` you passed, so display copy had to live in kebab-case ids. Give the step the label you want on screen:

```tsx
const step = { id: 'clone-repo', title: 'Cloning repository', status: 'running', description: '' };

<ProcessStepListItem step={step} isActive position={1} />;
// before: "Clone repo"
// after:  "Cloning repository"
```

**Added a `plain` variant to `ProcessStepListItem`** — for step lists that already sit inside a panel, where the boxed active card is one frame too many:

```tsx
<ProcessStepListItem step={step} isActive={step.status === 'running'} position={1} variant="plain" />
```
