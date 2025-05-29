# Exporting Your Agent

To make your agent available to the playground, you need to export it through the Mastra class in your `src/mastra/index.ts` file:

```typescript
import { Mastra } from "@mastra/core";
import { financialAgent } from "./agents";

export const mastra: Mastra = new Mastra({
  agents: {
    financialAgent,
  },
});
```

This creates a new Mastra instance that includes your financial agent, making it available to the playground and any other parts of your application.

The Mastra class is the main entry point for your Mastra project. It's responsible for registering your agents and making them available to the rest of your application. By adding your agent to the Mastra instance, you're telling Mastra that this agent should be available for use.
