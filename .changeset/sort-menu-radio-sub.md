---
'@mastra/playground-ui': minor
---

Added `SortMenu` at `@mastra/playground-ui/components/SortMenu`: an icon menu that picks one sort preset. Its trigger is named after the selected option and turns primary when the value moves off `baselineValue`. `SortMenu.Sub` puts the same choice inside another menu as a submenu row.

`DropdownMenu` gains two typed helpers for one-of-many choices. `DropdownMenu.RadioOptions` renders a list of options, and `DropdownMenu.RadioSub` puts them in a submenu whose row shows the selected label. `onValueChange` receives your option type, not `any`. `DropdownMenu.SubTrigger` also takes a `hint` to show a current value next to its chevron.

```tsx
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { SortMenu } from '@mastra/playground-ui/components/SortMenu';

<SortMenu label="Sort items" options={sortOptions} value={sort} onValueChange={setSort} baselineValue="newest" />;

<DropdownMenu>
  <DropdownMenu.Trigger>Properties</DropdownMenu.Trigger>
  <DropdownMenu.Content>
    <SortMenu.Sub options={sortOptions} value={sort} onValueChange={setSort} />
    <DropdownMenu.RadioSub label="Owner" options={ownerOptions} value={owner} onValueChange={setOwner} />
  </DropdownMenu.Content>
</DropdownMenu>;
```
