---
'@mastra/playground-ui': patch
---

Added direct import paths for toast and Playground UI icons so apps can avoid the root Playground UI barrel when using high-traffic utilities and icon components.

```ts
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { toast } from '@mastra/playground-ui/utils/toast';
```
