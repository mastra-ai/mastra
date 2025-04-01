# Memory-Powered Workflows

**Use Case**: Integrating memory with workflows to create stateful, context-aware multi-step processes.

**Why Users Need This**:
- Enable workflows to reference past conversations and user interactions
- Maintain context across different steps of a complex workflow
- Create workflows that adapt based on conversation history
- Persist workflow state across multiple sessions

**Implementation Example**:
```typescript
import { Workflow, Step } from "@mastra/core/workflows";
import { Memory } from "@mastra/memory";
import { PostgresStore } from "@mastra/pg";

// Create shared memory instance for the workflow
const memory = new Memory({
  storage: new PostgresStore({ connectionString: "postgresql://..." }),
});

// Agent with access to memory
const customerAgent = new Agent({
  name: "customer-agent",
  memory, // Same memory instance
  instructions: "You assist customers with their orders...",
  model: openai("gpt-4o"),
});

// Step that uses memory to check customer history
const customerHistoryStep = new Step({
  id: "customer-history",
  execute: async ({ context, mastra }) => {
    // Access the agent in this workflow
    const agent = mastra.getAgent("customerAgent");
    
    // Get conversation history from memory
    const { messages } = await agent.getMemory()?.query({
      threadId: context.triggerData.threadId,
      selectBy: {
        vectorSearchString: "previous orders",
      },
    });
    
    // Extract relevant information
    const orderHistory = extractOrderInfo(messages);
    
    return {
      customerHistory: orderHistory,
      hasExistingOrders: orderHistory.length > 0,
    };
  },
});

// Use memory results to inform next workflow steps
const workflow = new Workflow({
  name: "order-workflow",
})
.step(customerHistoryStep)
.then(customizeOfferStep, {
  variables: {
    previousOrders: { step: customerHistoryStep, path: 'customerHistory' }
  },
  when: { "customerHistory.hasExistingOrders": true }, 
})
.then(newCustomerStep, {
  when: { "customerHistory.hasExistingOrders": false },
})
.commit();
``` 