---
'@mastra/auth-workos': minor
---

Added a `@mastra/auth-workos/ee` import path for `MastraRBACWorkos` and `MastraFGAWorkos`. Role-based access control (RBAC) and fine-grained authorization (FGA) need a Mastra Enterprise Edition license in production, and the new path makes that visible in your imports. Importing these classes from `@mastra/auth-workos` still works but is deprecated.

**Before**

```ts
import { MastraAuthWorkos, MastraFGAWorkos, MastraRBACWorkos } from '@mastra/auth-workos';
```

**After**

```ts
import { MastraAuthWorkos } from '@mastra/auth-workos';
import { MastraFGAWorkos, MastraRBACWorkos } from '@mastra/auth-workos/ee';
```
