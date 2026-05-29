---
'@mastra/playground-ui': minor
---

Made `ButtonsGroup` compose joined controls (searchbar + dropdown pills, split buttons, steppers) cleanly, and improved `InputGroup` so it drops straight into one.

- `ButtonsGroup` with `spacing="close"` fuses outline, filled and `Select` segments into one pill with a single clean divider, a complete focus ring (no missing side), and no consumer width classes.
- `InputGroup` fills a flex row on its own, matches a same-size sibling height, and propagates size via `data-size` (no React context) — so an icon + input segment composes inside a `ButtonsGroup` pill with no layout classes.

Use `InputGroup` (icon as an `InputGroupAddon`, optional clear button as an `InputGroupButton`) to build an icon input — it owns the box, focus, hover and error states on the focusable wrapper:

```tsx
import {
  ButtonsGroup,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@mastra/playground-ui';

<ButtonsGroup spacing="close">
  <InputGroup variant="outline">
    <InputGroupAddon align="inline-start">
      <SearchIcon />
    </InputGroupAddon>
    <InputGroupInput placeholder="Search projects..." />
  </InputGroup>
  <Select value={sort} onValueChange={setSort}>
    <SelectTrigger className="rounded-full">
      <SelectValue />
    </SelectTrigger>
    <SelectContent align="end">{/* options */}</SelectContent>
  </Select>
</ButtonsGroup>;
```
