---
'@mastra/auth-okta': minor
---

Added a `@mastra/auth-okta/ee` import path for `MastraRBACOkta`. Role-based access control (RBAC) needs a Mastra Enterprise Edition license in production, and the new path makes that visible in your imports. Importing `MastraRBACOkta` from `@mastra/auth-okta` still works but is deprecated.

**Before**

```ts
import { MastraAuthOkta, MastraRBACOkta } from '@mastra/auth-okta';
```

**After**

```ts
import { MastraAuthOkta } from '@mastra/auth-okta';
import { MastraRBACOkta } from '@mastra/auth-okta/ee';
```
