# Registering with Mastra

Now you'll register your workflow with the main Mastra instance so you can use it alongside agents and tools.

## Updating Your Mastra Configuration

Open your `src/mastra/index.ts` file and add your workflow:

```typescript
import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { LibSQLStore } from "@mastra/libsql";

// Import your workflow
import { contentWorkflow } from "./workflows/content-workflow";

export const mastra = new Mastra({
  // Register your workflow here
  workflows: {
    contentWorkflow,
  },
  storage: new LibSQLStore({
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
});
```

Your workflow is now registered with Mastra! Next, you'll learn how to use it in the playground.
