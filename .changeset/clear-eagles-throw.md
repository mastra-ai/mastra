---
'@mastra/playground-ui': minor
---

Added `ContextMenu` to the design system. Built on Base UI, exposes a namespaced API (`ContextMenu.Trigger`, `.Content`, `.Item`, `.CheckboxItem`, `.RadioItem`, `.Label`, `.Separator`, `.Shortcut`, `.Group`, `.Sub`/`.SubTrigger`/`.SubContent`, `.RadioGroup`, `.Portal`), supports a destructive variant on `Item`, and mirrors the visual style of `DropdownMenu`.

```tsx
import { ContextMenu } from '@mastra/playground-ui';

<ContextMenu>
  <ContextMenu.Trigger className="…">Right click here</ContextMenu.Trigger>
  <ContextMenu.Content>
    <ContextMenu.Item>Rename</ContextMenu.Item>
    <ContextMenu.Item variant="destructive">Delete</ContextMenu.Item>
  </ContextMenu.Content>
</ContextMenu>;
```
