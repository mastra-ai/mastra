---
'@mastra/playground-ui': minor
---

Added Central Icons to `@mastra/playground-ui`. Each icon is its own module under `@mastra/playground-ui/icons/central/` and works inside `Icon` like any other icon. The icons are licensed under the Central Icons license, not Apache-2.0. See `CENTRAL-ICONS-LICENSE.md` in the package.

```tsx
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { IconMagnifyingGlass } from '@mastra/playground-ui/icons/central/IconMagnifyingGlass';

<Icon size="sm">
  <IconMagnifyingGlass />
</Icon>;
```
