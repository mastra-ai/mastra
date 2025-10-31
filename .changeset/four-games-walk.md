---
'@mastra/core': major
---

The `@mastra/core` package no longer allows top-level imports except for `Mastra` and `type Config`. You must use subpath imports for all other imports.

For example:

```diff
  import { Mastra, type Config } from "@mastra/core";
- import { Agent } from "@mastra/core";
- import { createTool } from "@mastra/core";
- import { createStep } from "@mastra/core";

+ import { Agent } from "@mastra/core/agent";
+ import { createTool } from "@mastra/core/tools";
+ import { createStep } from "@mastra/core/workflows";
```
