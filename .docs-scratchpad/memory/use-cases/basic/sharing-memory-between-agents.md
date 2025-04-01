# Sharing Memory Between Agents

**Use Case**: Multiple agents interacting with the same memory thread to provide continuous service.

**Why Users Need This**:
- Enable seamless handoff between specialized agents
- Maintain conversation continuity across different expertise domains
- Allow different agents to build upon shared context

**Implementation Example**:
```typescript
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { openai } from "@ai-sdk/openai";

// Create a shared memory instance
const memory = new Memory();

// Common memory configuration with shared parameters
const sharedResourceId = "customer_123";
const sharedThreadId = "support_thread_456";

// First agent (Sales specialist)
const salesAgent = new Agent({
  name: "Sales Specialist",
  instructions: "You are a sales specialist who helps customers understand our product offerings. When appropriate, hand off to an implementation specialist.",
  model: openai("gpt-4o"),
  memory: memory,
});

// Sales agent interacts with the customer
// Memory is automatically saved when using stream/generate
await salesAgent.stream("I'm interested in your enterprise plan.", {
  resourceId: sharedResourceId,
  threadId: sharedThreadId,
});

// Second agent (Implementation specialist) with the same thread parameters
const implementationAgent = new Agent({
  name: "Implementation Specialist",
  instructions: "You are an implementation specialist who helps customers set up and configure our products.",
  model: openai("gpt-4o"),
  memory: memory,
});

// Implementation agent accesses the same conversation thread
// Previous conversation history is automatically retrieved and included
await implementationAgent.stream("Can you help me implement the enterprise plan?", {
  resourceId: sharedResourceId,
  threadId: sharedThreadId,
});

// Later, a third agent (Support specialist) can similarly access
// the complete conversation history by using the same identifiers
const supportAgent = new Agent({
  name: "Support Specialist",
  instructions: "You are a support specialist who helps customers solve problems with their implementation.",
  model: openai("gpt-4o"),
  memory: memory,
});

// Support specialist continues the conversation with full context
// All previous messages are automatically retrieved and added to context
await supportAgent.stream("I'm having an issue with my implementation", {
  resourceId: sharedResourceId,
  threadId: sharedThreadId,
});
``` 