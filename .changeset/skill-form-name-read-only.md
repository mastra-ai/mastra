---
'@mastra/playground-ui': minor
---

`SkillSimpleForm` now accepts `nameReadOnly` to lock only the name field while the description and instructions stay editable.

```tsx
import { SkillSimpleForm } from '@mastra/playground-ui/domains/skills/skill-simple-form';

<SkillSimpleForm
  nameReadOnly
  name={name}
  onNameChange={setName}
  description={description}
  onDescriptionChange={setDescription}
  instructions={instructions}
  onInstructionsChange={setInstructions}
/>;
```
