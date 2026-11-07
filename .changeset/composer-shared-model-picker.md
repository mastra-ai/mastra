---
'@mastra/playground-ui': minor
---

Added shared composer layout pieces so Studio and Factory render the same chat composer.

- `ModelPicker` (`@mastra/playground-ui/domains/llm`): one trigger for provider and model, with a provider filter row, search across all providers, and a swipeable bottom `Drawer` on phones. Pass `settings` for controls such as the thinking level, `addProvider` for a "+" link to connect another provider, `renderProviderIcon` to use your own provider icons, and `openOnSelectedProvider` to open on the selected provider for large catalogs.
- `ComposerAttachMenu`: the "+" attach control with Camera (touch devices only), Photos and Files, plus your own `actions` such as "From a URL…". It opens as a menu on desktop and a bottom `Drawer` on phones.
- `ComposerStatus`: a right-aligned status row above the composer that hides itself when empty.
- `ComposerActionsStart` and `ComposerActionsEnd`: leading and trailing groups for the composer actions row.
- `ComposerHeader` `placement="overlay"`: floats the header above the composer so opening it never moves the transcript.

```tsx
import {
  Composer,
  ComposerActions,
  ComposerActionsEnd,
  ComposerActionsStart,
  ComposerAttachMenu,
  ComposerBox,
  ComposerHeader,
  ComposerInput,
  ComposerStatus,
} from '@mastra/playground-ui/components/Composer';
import { ModelPicker } from '@mastra/playground-ui/domains/llm';

<>
  <ComposerStatus>2 queued</ComposerStatus>
  <Composer onSubmit={send}>
    <ComposerHeader placement="overlay" open={reconnecting}>
      Reconnecting…
    </ComposerHeader>
    <ComposerBox>
      <ComposerInput placeholder="Message the agent" />
      <ComposerActions>
        <ComposerActionsStart>
          <ComposerAttachMenu onFiles={addFiles} accept="image/*" />
        </ComposerActionsStart>
        <ComposerActionsEnd>
          <ModelPicker
            providers={[{ id: 'openai', name: 'OpenAI', models: [{ id: 'gpt-5', name: 'GPT-5' }] }]}
            value={{ provider: 'openai', model: 'gpt-5' }}
            onValueChange={({ provider, model }) => setModel(provider, model)}
          />
          {sendButton}
        </ComposerActionsEnd>
      </ComposerActions>
    </ComposerBox>
  </Composer>
</>;
```
