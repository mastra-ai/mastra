---
'@mastra/playground-ui': patch
---

**Removed**

- `Entity`, `EntityName`, `EntityDescription`, `EntityContent`, and `EntityIcon` are no longer exported from `@mastra/playground-ui`. The `Composite/Entity` Storybook story is removed.

**Why**

- The component was only consumed by the local studio (`packages/playground`). No external usage was found, so it has been moved into the consuming package to keep `@mastra/playground-ui` focused on truly shared primitives.

**Migration**

If you imported these from `@mastra/playground-ui`, copy `Entity.tsx` into your project (it only depends on `Icon`, `Txt`, and `cn`, all still exported from `@mastra/playground-ui`) and update the import path.

Before:

```ts
import { Entity, EntityName, EntityDescription, EntityContent } from '@mastra/playground-ui';
```

After:

```ts
import { Entity, EntityName, EntityDescription, EntityContent } from '@/components/entity';
```
