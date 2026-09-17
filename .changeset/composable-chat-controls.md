---
'@mastra/playground-ui': minor
---

Added composable model selection, model settings, composer actions and voice controls. Studio and Factory use the shared presentation while retaining their own catalogs, policies, draft state and transport. Model selection supports a combined searchable menu with optional packs, or separate provider and model comboboxes.

```tsx
import { ModelPicker, ModelPickerTrigger, ModelPickerContent, ModelPickerModels } from '@mastra/playground-ui/components/ModelPicker';

<ModelPicker>
  <ModelPickerTrigger label={modelLabel} />
  <ModelPickerContent>
    <ModelPickerModels value={modelId} options={availableModels} onValueChange={setModelId} />
  </ModelPickerContent>
</ModelPicker>
```
