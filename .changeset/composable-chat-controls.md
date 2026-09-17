---
'@mastra/playground-ui': minor
---

Added composable model selection, model settings, and composer actions. Model selection supports a combined searchable menu with optional packs, or separate provider and model comboboxes. Model settings and composer action areas accept custom controls as children, and warning containers accept custom content.

```tsx
import { ModelPicker, ModelPickerTrigger, ModelPickerContent, ModelPickerModels } from '@mastra/playground-ui/components/ModelPicker';

<ModelPicker>
  <ModelPickerTrigger label={modelLabel} />
  <ModelPickerContent>
    <ModelPickerModels value={modelId} options={availableModels} onValueChange={setModelId} />
  </ModelPickerContent>
</ModelPicker>
```
