---
'@mastra/playground-ui': minor
---

Refined the focus state of form inputs in `@mastra/playground-ui`. Applies to `Input`, `InputGroup`, `Searchbar`, and `Textarea`.

- Removed the green border and glow that appeared on focus.
- On focus, the field shows a subtle background shift and brightens its border to a neutral tone, so the focused field stays clearly visible on any underlying surface.
- Made single-line inputs fully rounded to match the design system. Multi-line surfaces (`Textarea`, and `InputGroup` with a block-style addon) keep a softer `rounded-xl` corner.
- Added `filled` and `outline` variants for consumers that need to choose between the new surface treatment and a quieter border-only treatment.
- The `unstyled` variant of `Input` and `Textarea` no longer leaks the browser default focus outline.

`Input`, `Textarea`, and `InputGroup` default to the `filled` surface. `Searchbar` and `ListSearch` default to the `outline` (transparent) treatment. For `Searchbar` this matches its previous transparent look. `ListSearch` previously rendered a filled (`bg-surface2`), `rounded-lg` box, so its search fields across the list pages now read as transparent, fully-rounded pills — pass `variant="filled"` to keep them on a filled surface:

```tsx
import { Input, InputGroup, InputGroupAddon, InputGroupInput, Searchbar } from '@mastra/playground-ui';

<Input placeholder="Name" />
<Input variant="outline" placeholder="Name" />

<InputGroup variant="outline">
  <InputGroupAddon>
    <SearchIcon />
  </InputGroupAddon>
  <InputGroupInput placeholder="Email" />
</InputGroup>

<Searchbar label="Search agents" placeholder="Search agents..." onSearch={handleSearch} />
<Searchbar variant="filled" label="Search agents" placeholder="Search agents..." onSearch={handleSearch} />
```
