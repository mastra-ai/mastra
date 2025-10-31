---
'@mastra/core': major
---

The `@mastra/core` package no longer allows top-level imports. You must use subpath imports for all imports.

For example:

```diff
- import { Mastra } from "@mastra/core";
+ import { Mastra } from "@mastra/core/mastra";
```
