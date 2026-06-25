---
'@mastra/playground-ui': patch
---

Added a direct utility import for the class name helper so applications can avoid the root Playground UI barrel.

```ts
import { cn } from '@mastra/playground-ui/utils/cn';
```
