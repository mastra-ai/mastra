---
'@mastra/playground-ui': minor
---

Added shared model picker pieces, so apps don't copy them:

- `ModelPickerProvider.featured`: set it to `false` to tuck a provider you can use behind "+N", such as the vendors one gateway serves. Tucked providers now appear under "More providers"; only providers marked `connected: false` show the red dot and "Not connected".
- `modelPickerProviders`, `catalogModelPickerValue` and `findCatalogModel`: group a flat list of model ids like `openai/gpt-5` by provider for `ModelPicker`, and map a picked value back to its model.
- `ModelNotice`, `ModelNoticeCode` and `MissingProviderKeyNotice`: the warning line under a chat composer, such as "Set OPENAI_API_KEY to use this provider".
- `SpeechInputButton`: the dictation button for the chat composer's `speechInput` slot.

```tsx
import { ModelPicker, modelPickerProviders } from '@mastra/playground-ui/domains/llm';

<ModelPicker
  providers={modelPickerProviders(gatewayModels).map(provider => ({ ...provider, featured: false }))}
  value={value}
  onValueChange={setValue}
/>;
```
