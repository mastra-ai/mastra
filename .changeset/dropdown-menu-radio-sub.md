---
'@mastra/playground-ui': minor
---

`DropdownMenu` gains two typed helpers for one-of-many choices. `DropdownMenu.RadioOptions` renders a list of options, and `DropdownMenu.RadioSub` puts them in a submenu whose row shows the selected label, so a menu of several settings reads its current state without opening each submenu. `onValueChange` receives your option type, not `any`. `DropdownMenu.SubTrigger` also takes a `hint` to show a current value next to its chevron.

```tsx
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import type { DropdownMenuRadioOption } from '@mastra/playground-ui/components/DropdownMenu';

const ownerOptions: DropdownMenuRadioOption<'mine' | 'all'>[] = [
  { value: 'mine', label: 'Mine' },
  { value: 'all', label: 'Everyone' },
];

<DropdownMenu>
  <DropdownMenu.Trigger>Properties</DropdownMenu.Trigger>
  <DropdownMenu.Content>
    <DropdownMenu.RadioSub label="Owner" options={ownerOptions} value={owner} onValueChange={setOwner} />
  </DropdownMenu.Content>
</DropdownMenu>;
```
