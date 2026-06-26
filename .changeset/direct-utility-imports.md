---
'@mastra/playground-ui': patch
---

Added direct Playground UI subpaths for shared helpers so apps can avoid the root barrel when importing existing utility and rule builder APIs.

```ts
import { is401UnauthorizedError } from '@mastra/playground-ui/utils/errors';
import type { JsonSchema } from '@mastra/playground-ui/utils/json-schema';
import { RuleBuilder } from '@mastra/playground-ui/components/RuleBuilder';
```
