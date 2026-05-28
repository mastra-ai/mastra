---
'@mastra/playground-ui': patch
---

Refined the focus state of form inputs in `@mastra/playground-ui`. Applies to `Input`, `InputGroup`, `Searchbar`, and `Textarea`.

- Removed the green border and glow that appeared on focus.
- On focus, the field now shows a subtle background and border shift that reads on any underlying surface.
- Made single-line inputs fully rounded to match the design system. Multi-line surfaces (`Textarea`, and `InputGroup` with a block-style addon) keep a softer `rounded-xl` corner.
- The `unstyled` variant of `Input` and `Textarea` no longer leaks the browser default focus outline.

The public API is unchanged:

```tsx
import { Input, InputGroup, InputGroupAddon, InputGroupInput, Searchbar } from '@mastra/playground-ui';

<Input placeholder="Name" />

<InputGroup>
  <InputGroupAddon>
    <SearchIcon />
  </InputGroupAddon>
  <InputGroupInput placeholder="Email" />
</InputGroup>

<Searchbar label="Search agents" placeholder="Search agents..." onSearch={handleSearch} />
```
