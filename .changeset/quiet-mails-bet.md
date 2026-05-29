---
'@mastra/playground-ui': minor
---

Refined the focus state of form inputs in `@mastra/playground-ui`. Applies to `Input`, `InputGroup`, `Searchbar`, and `Textarea`.

- Removed the green border and glow that appeared on focus.
- On focus, the field now shows a subtle background and border shift that reads on any underlying surface.
- Made single-line inputs fully rounded to match the design system. Multi-line surfaces (`Textarea`, and `InputGroup` with a block-style addon) keep a softer `rounded-xl` corner.
- Added `filled` and `outline` variants for consumers that need to choose between the new surface treatment and a quieter border-only treatment.
- The `unstyled` variant of `Input` and `Textarea` no longer leaks the browser default focus outline.

The default API still uses the filled surface, and consumers can now opt into the outline treatment:

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
<Searchbar variant="outline" label="Search agents" placeholder="Search agents..." onSearch={handleSearch} />
```
