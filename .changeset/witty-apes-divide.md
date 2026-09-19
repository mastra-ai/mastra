---
'@mastra/playground-ui': minor
---

Added composable model picker menus, groups, status indicators and mode controls. Applications provide their own catalogs, selection callbacks and permissions.

```tsx
import {
  ModelPicker,
  ModelPickerContent,
  ModelPickerItem,
  ModelPickerTrigger,
} from '@mastra/playground-ui/components/ModelPicker';

<ModelPicker busy={isSaving}>
  <ModelPickerTrigger label={selectedModelLabel} />
  <ModelPickerContent>
    {models.map(model => (
      <ModelPickerItem key={model.id} value={model.id} onSelect={() => selectModel(model.id)}>
        {model.name}
      </ModelPickerItem>
    ))}
  </ModelPickerContent>
</ModelPicker>
```
