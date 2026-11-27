---
'@mastra/playground-ui': minor
---

Added shared model picker pieces, so apps don't copy them:

- `modelPickerProviders`, `catalogModelPickerValue` and `findCatalogModel`: group a flat list of model ids like `openai/gpt-5` by provider for `ModelPicker`, and map a picked value back to its model. Factory's model picker helpers now use them.
- `ModelNotice` and `MissingProviderKeyNotice`: the warning line under a chat composer, such as "Set OPENAI_API_KEY to use this provider".

```tsx
import { ModelPicker, modelPickerProviders } from '@mastra/playground-ui/domains/llm';

<ModelPicker providers={modelPickerProviders(gatewayModels)} value={value} onValueChange={setValue} />;
```
