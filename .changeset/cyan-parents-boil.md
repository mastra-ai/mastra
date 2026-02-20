---
'@mastra/core': minor
'@mastra/playground-ui': patch
'@mastra/ai-sdk': patch
'@mastra/react': patch
---

**Supervisor Pattern for Multi-Agent Coordination**

The supervisor pattern enables coordinating multiple agents through delegation using the existing `stream()` and `generate()` methods. A supervisor agent can delegate tasks to sub-agents, workflows, and tools with fine-grained control over execution flow, context sharing, and validation.

**Key Features:**

- **Delegation Hooks**: Control sub-agent execution with `onDelegationStart` and `onDelegationComplete` callbacks
- **Iteration Monitoring**: Track progress with `onIterationComplete` hook and provide feedback to guide the agent
- **Completion Scoring**: Automatically validate task completion with configurable scorers
- **Memory Isolation**: Sub-agents receive full conversation context but only save their delegation to memory
- **Tool Approval Propagation**: Tool approvals bubble up through the delegation chain to the supervisor level
- **Context Filtering**: Control what messages are shared with sub-agents via `contextFilter` callback
- **Bail Mechanism**: Stop execution early from delegation hooks with configurable strategies

**Basic Usage:**

```typescript
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

// Define sub-agents
const researchAgent = new Agent({
  id: 'research-agent',
  description: 'Gathers factual research on topics',
  model: 'openai/gpt-4o-mini',
});

const writingAgent = new Agent({
  id: 'writing-agent',
  description: 'Transforms research into articles',
  model: 'openai/gpt-4o-mini',
});

// Create supervisor
const supervisorAgent = new Agent({
  id: 'supervisor',
  instructions: `You coordinate research and writing tasks.
    Delegate to research-agent first, then writing-agent.`,
  model: 'openai/gpt-5.1',
  agents: { researchAgent, writingAgent },
  memory: new Memory(),
});

// Execute with supervisor pattern
const stream = await supervisorAgent.stream('Research AI trends', {
  maxSteps: 10,
});
```

**Advanced Usage with Hooks:**

```typescript
const stream = await supervisorAgent.stream('Research AI trends', {
  maxSteps: 10,

  // Monitor progress
  onIterationComplete: async context => {
    console.log(`Iteration ${context.iteration}`);

    // Provide feedback
    if (!context.text.includes('recommendations')) {
      return {
        continue: true,
        feedback: 'Please include recommendations.',
      };
    }

    return { continue: true };
  },

  // Control delegations
  delegation: {
    onDelegationStart: async context => {
      // Modify delegation
      if (context.primitiveId === 'research-agent') {
        return {
          proceed: true,
          modifiedPrompt: `${context.prompt}\n\nFocus on 2024-2025 data.`,
        };
      }
      return { proceed: true };
    },

    onDelegationComplete: async context => {
      // Bail on errors
      if (context.error) {
        context.bail();
      }
    },

    // Filter context passed to sub-agents
    contextFilter: ({ messages }) => {
      return messages.slice(-10); // Last 10 messages only
    },
  },

  // Validate completion
  completion: {
    scorers: [taskCompleteScorer],
    strategy: 'all',
  },
});
```

**Memory Isolation:**

Sub-agents receive full conversation context for better decision-making, but only their delegation prompt and response are saved to their memory:

```typescript
// Supervisor conversation:
// User: "My name is Alice"
// User: "I live in Paris"
// User: "What is my name?"

const stream = await supervisorAgent.stream('What is my name?');

// When supervisor delegates:
// ✅ Sub-agent sees all messages ("Alice", "Paris")
// ✅ Can make informed decisions with full context
// ✅ Only delegation + response saved to sub-agent memory
// ✅ Sub-agent memory stays clean and scoped
```

**Tool Approval Propagation:**

Tool approvals bubble up through the delegation chain:

```typescript
// Sub-agent with approval-required tool
const dataAgent = new Agent({
  tools: {
    findUser: createTool({
      requireApproval: true,
      execute: async input => database.findUser(input),
    }),
  },
});

const supervisorAgent = new Agent({
  agents: { dataAgent },
});

const stream = await supervisorAgent.stream('Find user 123');

for await (const chunk of stream.fullStream) {
  if (chunk.type === 'tool-call-approval') {
    // Handle at supervisor level
    await supervisorAgent.approveToolCall({
      runId: stream.runId,
      toolCallId: chunk.payload.toolCallId,
    });
  }
}
```

**Breaking Changes:**

None - this is a new feature using existing `stream()` and `generate()` APIs with new optional parameters.

**Migration from .network():**

The supervisor pattern is the recommended replacement for `.network()`. See the migration guide for details.
