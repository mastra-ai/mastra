---
'@mastra/playground-ui': minor
---

Added `leadingIcon` and `trailingIcon` to `Input`, and made `ButtonsGroup` compose joined controls (searchbar + dropdown pills, split buttons, steppers) cleanly.

- `Input` now accepts `leadingIcon` / `trailingIcon` to place an icon, clear button or unit inside the field; the focus outline follows the rounded shape.
- `ButtonsGroup` with `spacing="close"` fuses outline, filled and `Select` segments into one pill with a single clean divider, a complete focus ring (no missing side), and no consumer width classes.
- `InputGroup` fills a flex row on its own, matches a same-size sibling height, and propagates size via `data-size` (no React context).

```tsx
import {
  ButtonsGroup,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@mastra/playground-ui';

<ButtonsGroup spacing="close">
  <Input variant="outline" leadingIcon={<SearchIcon />} placeholder="Search projects..." />
  <Select value={sort} onValueChange={setSort}>
    <SelectTrigger className="rounded-full">
      <SelectValue />
    </SelectTrigger>
    <SelectContent align="end">{/* options */}</SelectContent>
  </Select>
</ButtonsGroup>;
```
