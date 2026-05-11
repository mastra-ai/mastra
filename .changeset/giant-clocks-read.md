---
'@mastra/playground-ui': patch
---

**Polished Combobox dropdown items**

- Moved the selection check to the right of each item so unselected rows no longer carry an awkward left padding gap and the whole list aligns consistently.
- Tightened popup search/empty padding and softened the trigger hover for a calmer command-palette feel.

**Added `ComboboxPrimitive` export for advanced compositions**

Re-exports the raw `@base-ui/react/combobox` parts (Root, Trigger, Input, List, Item, Chips, etc.) so callers needing virtualization, async status, chips, or creatable patterns can compose them directly with the shared `comboboxStyles` tokens — without growing the monolithic `<Combobox>` prop surface.

```tsx
import { ComboboxPrimitive, comboboxStyles } from '@mastra/playground-ui';

<ComboboxPrimitive.Root items={items}>
  <ComboboxPrimitive.Input className={comboboxStyles.searchInput} />
  <ComboboxPrimitive.Portal>
    <ComboboxPrimitive.Positioner>
      <ComboboxPrimitive.Popup className={comboboxStyles.popup}>
        <ComboboxPrimitive.List className={comboboxStyles.list}>
          {(item) => (
            <ComboboxPrimitive.Item value={item} className={comboboxStyles.item}>
              {item.label}
            </ComboboxPrimitive.Item>
          )}
        </ComboboxPrimitive.List>
      </ComboboxPrimitive.Popup>
    </ComboboxPrimitive.Positioner>
  </ComboboxPrimitive.Portal>
</ComboboxPrimitive.Root>
```
