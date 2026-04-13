# Style Guide

## Naming Conventions

| Element               | Convention           | Example                                   |
| --------------------- | -------------------- | ----------------------------------------- |
| Variables & Functions | camelCase            | `getUserName`, `isActive`                 |
| Constants             | UPPER_SNAKE_CASE     | `MAX_RETRIES`, `API_BASE_URL`             |
| Classes & Types       | PascalCase           | `UserService`, `PullRequestData`          |
| Files                 | kebab-case           | `user-service.ts`, `pr-review.ts`         |
| Booleans              | is/has/should prefix | `isValid`, `hasPermission`, `shouldRetry` |
| Event handlers        | handle/on prefix     | `handleClick`, `onSubmit`                 |

## Code Organization

Order sections within a file:

1. Imports (external → internal → relative)
2. Constants and configuration
3. Type definitions
4. Helper/utility functions
5. Main functions or class definition
6. Exports

## Import Ordering

```typescript
// 1. Node built-ins
import { resolve } from 'node:path';

// 2. External packages
import { z } from 'zod';

// 3. Internal/project imports
import { myUtil } from '@/utils';

// 4. Relative imports
import { helper } from './helper';
```

## Error Handling

- Use explicit error handling — don't silently swallow errors
- Prefer specific error types over generic `Error`
- Always handle promise rejections
- Log errors with enough context for debugging

## Comments

- Write "why" comments, not "what" comments
- Bad: `// increment counter` → Good: `// Retry up to 3 times to handle transient network failures`
- Use JSDoc for public API functions
- Remove commented-out code — use version control instead
