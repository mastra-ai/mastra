---
'@mastra/playground-ui': minor
---

Improved process step indicators with theme-aware status colors and a plain embedded style.

**Step labels now come from `title`.** `ProcessStepListItem` used to build its heading from the step id and ignore the `title` you passed, so display copy had to live in kebab-case ids. Give the step the label you want on screen:

```tsx
const step = { id: 'clone-repo', title: 'Cloning repository', status: 'running', description: '', isActive: true };

<ProcessStepListItem step={step} isActive position={1} />;
// before: "Clone repo"
// after:  "Cloning repository"
```

The `stepId` prop is now optional and ignored; drop it from your call sites.

**Added a `plain` variant to `ProcessStepListItem`** — for step lists that already sit inside a panel, where the boxed active card is one frame too many:

```tsx
<ProcessStepListItem step={step} isActive={step.status === 'running'} position={1} variant="plain" />
```
