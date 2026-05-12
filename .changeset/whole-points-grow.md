---
'@mastra/playground-ui': minor
---

Added `InputGroup` and extended `ButtonsGroup` in playground-ui design system.

**New `InputGroup` component**

Compose inputs with leading or trailing icons, buttons, text labels, and keyboard hints. Supports inline (left/right) and block (top/bottom) addon alignment, and works with both inputs and textareas.

```tsx
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupButton } from '@mastra/playground-ui';
import { SearchIcon, XIcon } from 'lucide-react';

<InputGroup>
  <InputGroupAddon>
    <SearchIcon />
  </InputGroupAddon>
  <InputGroupInput placeholder="Search..." />
  <InputGroupAddon align="inline-end">
    <InputGroupButton aria-label="Clear">
      <XIcon />
    </InputGroupButton>
  </InputGroupAddon>
</InputGroup>;
```

**Extended `ButtonsGroup`**

Added `orientation` (`horizontal` | `vertical`), and new `ButtonsGroupSeparator` and `ButtonsGroupText` slots. Existing API unchanged.

```tsx
<ButtonsGroup spacing="close">
  <Button variant="outline">−</Button>
  <ButtonsGroupText>42</ButtonsGroupText>
  <Button variant="outline">+</Button>
</ButtonsGroup>

<ButtonsGroup orientation="vertical">
  <Button variant="ghost">Copy</Button>
  <ButtonsGroupSeparator />
  <Button variant="ghost">Cut</Button>
</ButtonsGroup>
```

**Tweaked `Button` ghost variant**

Aligned hover/active progression with the outline variant (`surface3` → `surface4`) so click feedback is perceptible on transparent backgrounds. Existing ghost buttons throughout the playground will appear one shade lighter on hover and active.
