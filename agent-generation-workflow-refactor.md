# Agent Generation Workflow Refactoring

This refactoring transforms the agent's `generate` command from an imperative approach to a declarative Mastra workflow that expresses the before and after processing as distinct workflow steps.

## Overview

The original `generate` method in the Agent class had complex before/after logic embedded within the method. This refactoring extracts that lifecycle into a structured Mastra workflow with three distinct steps:

1. **Before Step**: Setup and preparation (memory, tools, context)
2. **Generation Step**: Core LLM processing
3. **After Step**: Cleanup and persistence (memory saving, scoring)

## Key Benefits

### 🔍 **Better Observability**
- Each step is independently observable and debuggable
- Clear separation of concerns between setup, processing, and cleanup
- Built-in workflow telemetry and logging

### ⏸️ **Workflow Control Flow**
- Ability to suspend/resume execution at any step
- Retry failed steps independently
- Conditional logic and branching capabilities

### 🧩 **Modular Architecture**
- Before/after logic is now composable and reusable
- Each step can be tested in isolation
- Easier to extend with additional processing steps

### 📊 **Enhanced Error Handling**
- Step-level error boundaries
- Granular retry policies per step
- Better error context and debugging information

## Implementation

### New Files Created

1. **`packages/core/src/agent/generation-workflow.ts`**
   - Contains the `createAgentGenerationWorkflow()` function
   - Defines the three-step workflow (before, generation, after)
   - Maintains full compatibility with existing agent options

2. **`examples/agent-generation-workflow-example.ts`**
   - Demonstrates usage of the new workflow-based approach
   - Shows comparison between traditional and workflow approaches

### Workflow Steps Breakdown

#### Step 1: Before Generation
```typescript
const beforeStep = createStep({
  id: 'before-generation',
  description: 'Prepare agent generation context, memory, and tools',
  execute: async ({ inputData }) => {
    // Extract and process generation options
    // Setup memory, threading, and context
    // Prepare tools and message processing
    // Return prepared state for generation
  }
});
```

#### Step 2: LLM Generation  
```typescript
const generationStep = createStep({
  id: 'llm-generation', 
  description: 'Execute LLM generation with prepared context and tools',
  execute: async ({ inputData }) => {
    // Execute appropriate LLM method (text, textObject, etc.)
    // Handle tool calls and step callbacks
    // Return generation results
  }
});
```

#### Step 3: After Generation
```typescript
const afterStep = createStep({
  id: 'after-generation',
  description: 'Handle post-generation tasks like memory persistence and scoring', 
  execute: async ({ inputData }) => {
    // Save messages to memory
    // Run scorers and evaluations
    // Handle title generation for threads
    // Return final results
  }
});
```

## Usage Examples

### Traditional Approach (Before)
```typescript
const agent = new Agent({
  name: 'MyAgent',
  instructions: 'You are a helpful assistant.',
  model: openai('gpt-4o-mini'),
});

const result = await agent.generate('Hello, world!');
```

### Workflow Approach (After)
```typescript
import { createAgentGenerationWorkflow } from '@mastra/core/agent/generation-workflow';

const agent = new Agent({
  name: 'MyAgent', 
  instructions: 'You are a helpful assistant.',
  model: openai('gpt-4o-mini'),
});

// Create the generation workflow
const generationWorkflow = createAgentGenerationWorkflow(agent);

// Execute as a workflow
const run = generationWorkflow.createRun();
const result = await run.start({
  inputData: {
    messages: 'Hello, world!',
    generateOptions: { temperature: 0.7 }
  }
});

console.log(result.finalResult.text);
```

## Backward Compatibility

The existing `agent.generate()` method remains unchanged and fully functional. The workflow approach is additive and provides an alternative execution path with enhanced capabilities.

## Future Enhancements

With this workflow foundation, we can easily add:

- **Conditional Processing**: Different generation paths based on input
- **Parallel Tool Execution**: Run multiple tools concurrently  
- **Multi-Model Routing**: Route to different models based on complexity
- **Caching Strategies**: Cache results at specific workflow steps
- **A/B Testing**: Run different generation strategies in parallel
- **Human-in-the-Loop**: Pause for human approval before proceeding

## Migration Path

1. **Phase 1**: Both approaches coexist (current state)
2. **Phase 2**: Gradually migrate internal usage to workflow approach
3. **Phase 3**: Deprecate direct generate() usage in favor of workflow
4. **Phase 4**: Implement generate() as a wrapper around the workflow

This refactoring provides a solid foundation for more sophisticated agent processing patterns while maintaining the simplicity of the existing API.