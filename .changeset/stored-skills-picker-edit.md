---
'@mastra/playground-ui': minor
---

Add an optional `onEdit` callback to `StoredSkillsPicker` so hosts can open their own editor for an available skill without changing its selection. The Edit action appears only when the callback is provided.

```tsx
<StoredSkillsPicker
  availableSkills={skills}
  selectedSkillIds={selectedSkillIds}
  onAttach={attachSkill}
  onRemove={removeSkill}
  onEdit={skillId => openSkillEditor(skillId)}
/>
```
