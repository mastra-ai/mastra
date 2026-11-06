---
'@mastra/auth-google': minor
---

Added a `@mastra/auth-google/ee` import path for `MastraRBACGoogle`. Role-based access control (RBAC) needs a Mastra Enterprise Edition license in production, and the new path makes that visible in your imports. Importing `MastraRBACGoogle` from `@mastra/auth-google` still works but is deprecated.

**Before**

```ts
import { MastraAuthGoogle, MastraRBACGoogle } from '@mastra/auth-google';
```

**After**

```ts
import { MastraAuthGoogle } from '@mastra/auth-google';
import { MastraRBACGoogle } from '@mastra/auth-google/ee';
```
