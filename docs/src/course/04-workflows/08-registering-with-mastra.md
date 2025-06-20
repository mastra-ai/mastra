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
    contentWorkflow
  },
  storage: new LibSQLStore({
    url: ":memory:"
  }),
  logger: new PinoLogger({
    name: "Mastra",
    level: "info"
  })
});
```

## Testing the Registration

Create a new test file to verify the registration:

```typescript
// src/test-workflow-registration.ts
import { mastra } from "./mastra";

async function testRegistration() {
  console.log("🔍 Testing workflow registration...");
  
  // Get the workflow from Mastra
  const workflow = mastra.getWorkflow("contentWorkflow");
  
  if (!workflow) {
    console.error("❌ Workflow not found!");
    return;
  }
  
  console.log("✅ Workflow found:", workflow.id);
  console.log("📝 Description:", workflow.description);
}

testRegistration();
```

## Running the Registration Test

```bash
npx tsx src/test-workflow-registration.ts
```

You should see:
```
🔍 Testing workflow registration...
✅ Workflow found: content-processing-workflow
📝 Description: Validates and enhances content
```

Your workflow is now registered with Mastra! Next, you'll learn how to use it in the playground.