---
'@mastra/playground-ui': minor
---

Switched `@mastra/playground-ui` components from Lucide to Central Icons, and added Central Icons for your own UI. Each icon is its own module under `@mastra/playground-ui/icons/central/` and works inside `Icon` like any other icon. The icons are licensed under the Central Icons license, not Apache-2.0. See `CENTRAL-ICONS-LICENSE.md` in the package.

```tsx
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { IconMagnifyingGlass } from '@mastra/playground-ui/icons/central/IconMagnifyingGlass';

<Icon size="sm">
  <IconMagnifyingGlass />
</Icon>;
```
