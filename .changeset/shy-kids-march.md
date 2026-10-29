---
'@mastra/playground-ui': minor
---

Added a shared `SkillSimpleForm` skill editor (name, description, and Markdown instructions, with an optional read-only mode) at `@mastra/playground-ui/domains/skills/skill-simple-form`, so apps other than Studio can show and edit skills with the same component.

```tsx
import { SkillSimpleForm } from '@mastra/playground-ui/domains/skills/skill-simple-form';

<SkillSimpleForm
  name={name}
  onNameChange={setName}
  description={description}
  onDescriptionChange={setDescription}
  instructions={instructions}
  onInstructionsChange={setInstructions}
/>;
```
