---
'@mastra/playground-ui': minor
---

Added composable Combobox parts, so a combobox can search right in the field, show multi-select picks as removable chips, and render grouped or rich items (title, description, end detail). The parts follow shadcn's Combobox structure. `ComboboxRoot` is the root, since `Combobox` stays the options-based component.

```tsx
import {
  ComboboxRoot,
  ComboboxInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxList,
  ComboboxItem,
} from '@mastra/playground-ui/components/Combobox';

<ComboboxRoot items={agents} value={agent} onValueChange={setAgent} autoHighlight>
  <ComboboxInput placeholder="Pick an agent" />
  <ComboboxContent>
    <ComboboxEmpty>No agents found.</ComboboxEmpty>
    <ComboboxList>
      {item => (
        <ComboboxItem key={item.id} value={item}>
          {item.name}
        </ComboboxItem>
      )}
    </ComboboxList>
  </ComboboxContent>
</ComboboxRoot>;
```

For small triggers (an icon, a ghost button), use `ComboboxTrigger` with `ComboboxSearch` at the top of `ComboboxContent` to keep the search inside the popup.
