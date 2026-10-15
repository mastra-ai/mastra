---
'@mastra/playground-ui': minor
---

Comboboxes in forms now search right in the field. Inside a `Field`, a `Combobox` is a text field you type into to filter, and a `multiple` one shows its picks as removable chips (× or Backspace removes one) instead of "N selected". Comboboxes outside a `Field` (toolbars, breadcrumbs, inline pickers), `ghost` and icon-size triggers keep the trigger with the search in the popup. The `Combobox` props are unchanged.

`Combobox` is now built on new composable parts, also exported, for pickers its `options` prop can't describe: groups with labels, items with a title, description and end detail, or a custom field. They follow shadcn's Combobox structure; the root is `ComboboxRoot` because `Combobox` is the options-based component.

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
