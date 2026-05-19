---
'@mastra/playground-ui': minor
---

Added `ContextMenu` for right-click interactions. Supports submenus, checkbox and radio items, keyboard shortcuts, and a `destructive` variant for dangerous actions like delete.

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
