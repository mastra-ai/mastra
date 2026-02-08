---
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/inngest': patch
'@mastra/server': patch
'@mastra/core': patch
'mastra': patch
'create-mastra': patch
---

Steps now support an optional `metadata` property for storing arbitrary key-value data. This metadata is preserved through step serialization and is available in the workflow graph, enabling use cases like UI annotations or custom step categorization.

```diff
import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step = createStep({
  //...step information
+  metadata: {
+    category: "orders",
+    priority: "high",
+    version: "1.0.0",
+  },
});
```

Metadata values must be serializable (no functions or circular references).
