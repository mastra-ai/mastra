---
'@mastra/playground-ui': major
---

Removed the `Searchbar` component from `@mastra/playground-ui`. Compose search inputs with `InputGroup` instead so search remains a documented use case of the existing input composition primitive.

**Before**

```tsx
import { Searchbar } from '@mastra/playground-ui/components/Searchbar';

<Searchbar label="Search tools" placeholder="Search tools..." onSearch={setSearch} />;
```

**After**

```tsx
import { InputGroup, InputGroupAddon, InputGroupInput } from '@mastra/playground-ui/components/InputGroup';
import { SearchIcon } from 'lucide-react';

<InputGroup variant="outline">
  <InputGroupAddon align="inline-start">
    <SearchIcon />
  </InputGroupAddon>
  <InputGroupInput
    type="search"
    aria-label="Search tools"
    placeholder="Search tools..."
    onChange={event => setSearch(event.target.value)}
  />
</InputGroup>;
```
