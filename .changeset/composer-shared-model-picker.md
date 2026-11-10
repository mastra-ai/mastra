---
'@mastra/playground-ui': minor
---

Added shared composer layout pieces so Studio and Factory render the same chat composer.

- `ModelPicker` (`@mastra/playground-ui/domains/llm`): one trigger for provider and model, with search across all providers, a provider filter row when there is more than one provider, and a swipeable bottom `Drawer` on phones. Providers with `connected: false` sit behind a "+N" button that lists them, and search shows the first 50 matches, so catalogs of thousands of models stay responsive. On desktop, search and the list sit in an inset card, and the list scrolls under the search field. Pass raw catalog ids and the picker shows readable names ("claude-opus-4-6" as "Claude Opus 4.6"), sorts each provider newest first by `releaseDate`, and leads every row with its provider logo. Set `defaultModel` to mark the default model, and `resetLabel` to offer a one-click way back to it whenever another model is picked. Pass `settings` for controls such as the thinking level, `addProvider` for a "+" link beside the search field to connect another provider, `renderProviderIcon` to use your own provider icons, and `openOnSelectedProvider` to open on the selected provider for large catalogs.
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
            providers={[{ id: 'openai', name: 'OpenAI', models: [{ id: 'gpt-5', releaseDate: '2025-08-07' }] }]}
            value={{ provider: 'openai', model: 'gpt-5' }}
            defaultModel={{ provider: 'openai', model: 'gpt-5' }}
            onValueChange={({ provider, model }) => setModel(provider, model)}
          />
          {sendButton}
        </ComposerActionsEnd>
      </ComposerActions>
    </ComposerBox>
  </Composer>
</>;
```
