---
'@mastra/auth-neon': minor
---

Added a `@mastra/auth-neon/ee` import path for `MastraRBACNeon`. Role-based access control (RBAC) needs a Mastra Enterprise Edition license in production, and the new path makes that visible in your imports. Importing `MastraRBACNeon` from `@mastra/auth-neon` still works but is deprecated.

**Before**

```ts
import { MastraAuthNeon, MastraRBACNeon } from '@mastra/auth-neon';
```

**After**

```ts
import { MastraAuthNeon } from '@mastra/auth-neon';
import { MastraRBACNeon } from '@mastra/auth-neon/ee';
```
