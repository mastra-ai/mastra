---
'@mastra/playground-ui': minor
---

Added shared composer pieces: a combined provider and model picker, an attach menu, a status row and grouped action slots.

- `ModelPicker` (`@mastra/playground-ui/domains/llm`) is one trigger for provider and model. It searches across every provider, shows a provider filter row when there is more than one provider, and opens as a swipeable bottom `Drawer` on phones.
  - Pass raw catalog ids: the picker shows readable names ("claude-opus-4-6" as "Claude Opus 4.6"), sorts each provider newest first by `releaseDate`, and leads every row with its provider logo.
  - Catalogs of thousands of models stay responsive: providers with `connected: false` sit behind a "+N" button, and search shows the first 50 matches.
  - `defaultModel` marks the default model. `reset` adds an action at the end of the list, e.g. clearing an override; pass it only while there is something to reset.
  - `settings` holds controls such as the thinking level, and `addProvider` puts a "+" link beside the search field.
  - `renderProviderIcon` swaps in your own provider icons, and `openOnSelectedProvider` opens filtered to the selected provider.
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
            reset={override ? { label: 'Reset to the default', onClick: clearOverride } : undefined}
            onValueChange={({ provider, model }) => setModel(provider, model)}
          />
          {sendButton}
        </ComposerActionsEnd>
      </ComposerActions>
    </ComposerBox>
  </Composer>
</>;
```
