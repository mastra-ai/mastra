# Mastra AI Tracing Context Integration Plan

## Overview

This document outlines the plan to implement automatic AI tracing context propagation throughout Mastra's execution contexts, eliminating the need for users to manually pass tracing context while still providing access for custom span creation.

## Goals

1. **Automatic Trace Continuity**: Agent and workflow calls within any execution context should automatically maintain trace hierarchy without user intervention
2. **Manual Span Creation**: Users should still have access to create custom child spans and add metadata
3. **Universal Coverage**: Anywhere the `mastra` object is provided to user code within an existing span context, tracing should be automatic
4. **Transparent Operation**: Existing code should work without changes
5. **Type Safety**: Full TypeScript support should be preserved
6. **Graceful Degradation**: Tracing failures should never break application functionality

## Technical Approach

### Context-Aware Mastra Wrapping

Since the Mastra instance is shared across all executions but each execution context needs its own tracing context, we'll create wrapped versions of Mastra that have the current span context baked in.

```typescript
// Each execution context gets its own wrapped Mastra instance
const wrappedMastra = wrapMastra(originalMastra, currentAISpan);
```

### Proxy-Based Implementation

We'll use JavaScript Proxies to create transparent wrappers that:

- Preserve all method signatures and TypeScript types automatically
- Intercept specific methods to inject tracing context
- Pass through all other methods unchanged

## Implementation Plan

### Phase 1: Core Infrastructure

#### 1.1 Update AITracingContext Interface

- Rename `parentAISpan` to `currentAISpan` in `packages/core/src/ai-tracing/types.ts`
- Update all references throughout the codebase

```typescript
export interface AITracingContext {
  /** Current AI span for creating child spans and adding metadata */
  currentAISpan?: AnyAISpan;
}
```

#### 1.2 Create Proxy-Based Wrappers

Create new file: `packages/core/src/ai-tracing/context-integration.ts`

```typescript
/**
 * Creates a tracing-aware Mastra proxy that automatically injects
 * AI tracing context into agent and workflow method calls
 */
export function wrapMastra<T extends Mastra>(mastra: T, aiTracingContext: AITracingContext): T {
  // Don't wrap if no current span or if using NoOp span
  if (!aiTracingContext.currentAISpan || isNoOpSpan(aiTracingContext.currentAISpan)) {
    return mastra;
  }

  return new Proxy(mastra, {
    get(target, prop) {
      // Wrap agent getters
      if (prop === 'getAgent' || prop === 'getAgentById') {
        return (...args: any[]) => {
          const agent = target[prop](...args);
          return wrapAgent(agent, aiTracingContext);
        };
      }

      // Wrap workflow getters
      if (prop === 'getWorkflow' || prop === 'getWorkflowById') {
        return (...args: any[]) => {
          const workflow = target[prop](...args);
          return wrapWorkflow(workflow, aiTracingContext);
        };
      }

      // Pass through all other methods unchanged
      return target[prop];
    },
  });
}
```

#### 1.3 Create Agent and Workflow Wrappers

```typescript
function wrapAgent<T extends Agent>(agent: T, aiTracingContext: AITracingContext): T {
  // Don't wrap if no current span or if using NoOp span
  if (!aiTracingContext.currentAISpan || isNoOpSpan(aiTracingContext.currentAISpan)) {
    return agent;
  }

  return new Proxy(agent, {
    get(target, prop) {
      // Wrap tracing-relevant methods
      if (prop === 'generate' || prop === 'stream' || prop === 'streamV2') {
        return (input: any, options: any = {}) => {
          return target[prop](input, {
            ...options,
            aiTracingContext,
          });
        };
      }

      return target[prop];
    },
  });
}

function wrapWorkflow<T extends Workflow>(workflow: T, aiTracingContext: AITracingContext): T {
  // Don't wrap if no current span or if using NoOp span
  if (!aiTracingContext.currentAISpan || isNoOpSpan(aiTracingContext.currentAISpan)) {
    return workflow;
  }

  return new Proxy(workflow, {
    get(target, prop) {
      // Wrap workflow execution methods with tracing context
      if (prop === 'execute' || prop === 'stream') {
        return (input: any, options: any = {}) => {
          return target[prop](input, {
            ...options,
            aiTracingContext,
          });
        };
      }

      return target[prop];
    },
  });
}

/**
 * Helper function to detect NoOp spans to avoid unnecessary wrapping
 */
function isNoOpSpan(span: AnyAISpan): boolean {
  // Check if this is a NoOp span implementation
  return span.constructor.name === 'NoOpAISpan' || (span as any).__isNoOp === true || !span.aiTracing; // NoOp spans might not have aiTracing reference
}
```

### Phase 2: Integration Points

#### 2.1 Workflow Step Execution

Modify `packages/core/src/workflows/default.ts` in the `_runStep` function:

```typescript
const _runStep = (step: Step<any, any, any, any>, spanName: string, attributes?: Record<string, string>) => {
  return async (data: any) => {
    // Create step span...
    const stepAISpan = workflowAISpan?.createChildSpan({
      type: AISpanType.WORKFLOW_STEP,
      name: spanName,
      attributes: { stepId: step.id, ...attributes },
    });

    const aiTracingContext: AITracingContext = {
      currentAISpan: stepAISpan,
    };

    // Create wrapped Mastra instance with tracing context
    const wrappedMastra = wrapMastra(data.mastra, aiTracingContext);

    const enhancedData = {
      ...data,
      mastra: wrappedMastra, // Pass wrapped version instead of original
      aiTracingContext, // Still available for manual span creation
    };

    // Continue with step execution...
  };
};
```

#### 2.2 Tool Execution Context

When tools are executed with access to the Mastra instance, wrap it similarly:

```typescript
// In tool execution contexts
const wrappedMastra = wrapMastra(mastra, aiTracingContext);

// Provide wrapped instance to tool execution
const toolResult = await executeTool({
  ...toolConfig,
  mastra: wrappedMastra,
  aiTracingContext,
});
```

#### 2.3 Other Execution Contexts

Apply the same pattern anywhere Mastra is provided to user code within a span:

- Custom tool implementations
- Agent lifecycle hooks
- Workflow middleware
- Plugin execution contexts
- Custom execution environments

```typescript
// Generic pattern for any execution context
function executeWithTracing<T>(
  executor: (mastra: Mastra, context: AITracingContext) => Promise<T>,
  mastra: Mastra,
  currentSpan: AnyAISpan,
): Promise<T> {
  const aiTracingContext = { currentAISpan: currentSpan };
  // wrapMastra will automatically return original if NoOp span
  const wrappedMastra = wrapMastra(mastra, aiTracingContext);

  return executor(wrappedMastra, aiTracingContext);
}
```

### Phase 3: Error Handling and Fallbacks

#### 3.1 Graceful Degradation

Add error handling to all wrapper functions:

```typescript
function wrapMastra<T extends Mastra>(mastra: T, aiTracingContext: AITracingContext): T {
  // Don't wrap if no current span or if using NoOp span
  if (!aiTracingContext.currentAISpan || isNoOpSpan(aiTracingContext.currentAISpan)) {
    return mastra;
  }

  try {
    return new Proxy(mastra, {
      get(target, prop) {
        // Wrapping logic with try/catch
        try {
          // ... proxy implementation
        } catch (error) {
          console.warn('AI Tracing: Failed to wrap method, falling back to original', error);
          return target[prop];
        }
      },
    });
  } catch (error) {
    console.warn('AI Tracing: Failed to create proxy, using original Mastra instance', error);
    return mastra;
  }
}
```

#### 3.2 Stale Context Detection

Add optional validation to detect stale spans:

```typescript
function validateSpanContext(aiTracingContext: AITracingContext): boolean {
  const span = aiTracingContext.currentAISpan;
  if (span?.endTime) {
    console.warn('AI Tracing: Using ended span context, traces may be incomplete');
    return false;
  }
  return true;
}
```

### Phase 4: Testing Strategy

#### 4.1 Integration Tests

Create `packages/core/src/ai-tracing/context-integration.test.ts`:

```typescript
describe('Mastra AI Tracing Context Integration', () => {
  test('wrapped agent creates child spans in workflow steps', async () => {
    // Test that agent.generate() creates spans under step spans
  });

  test('wrapped agent creates child spans in tool execution', async () => {
    // Test that agent calls from tools create proper spans
  });

  test('wrapped workflow creates proper span hierarchy', async () => {
    // Test workflow-calling-workflow scenarios
  });

  test('manual span creation works with aiTracingContext', async () => {
    // Test user creating custom spans in any execution context
  });

  test('original functionality preserved across contexts', async () => {
    // Test that business logic works identically in all contexts
  });

  test('graceful fallback on errors', async () => {
    // Test error scenarios don't break functionality
  });

  test('no wrapping when NoOp span is used', async () => {
    // Test that wrapping is skipped when tracing is disabled
    const noOpContext = { currentAISpan: new NoOpAISpan() };
    const wrappedMastra = wrapMastra(mastra, noOpContext);
    expect(wrappedMastra).toBe(mastra); // Should return original instance
  });
});
```

#### 4.2 Type Safety Tests

Verify TypeScript compilation and intellisense:

```typescript
test('wrapped objects preserve all type information', () => {
  const wrappedMastra = wrapMastra(mastra, context);
  const wrappedAgent = wrappedMastra.getAgent('testAgent');

  // Should compile with full type safety
  const result: GenerateTextResult = await wrappedAgent.generate(
    'test input',
    { temperature: 0.7 }, // Should have full intellisense
  );
});
```

## User Experience

### Before (Manual Context Passing)

```typescript
// In workflow steps
execute: async ({ inputData, mastra, aiTracingContext }) => {
  const agent = mastra.getAgent('myAgent');
  const response = await agent.generate(inputData.text, {
    aiTracingContext, // User must remember this
  });
  return { result: response.text };
};

// In tool execution
async function myTool({ mastra, aiTracingContext }) {
  const agent = mastra.getAgent('helper');
  return await agent.generate('help me', {
    aiTracingContext, // User must remember this everywhere
  });
}
```

### After (Automatic Context)

```typescript
// In workflow steps
execute: async ({ inputData, mastra, aiTracingContext }) => {
  const agent = mastra.getAgent('myAgent');
  const response = await agent.generate(inputData.text); // Just works!

  // aiTracingContext still available for custom spans
  const customSpan = aiTracingContext.currentAISpan.createChildSpan({
    type: AISpanType.GENERIC,
    name: 'custom-operation',
  });

  return { result: response.text };
};

// In tool execution
async function myTool({ mastra, aiTracingContext }) {
  const agent = mastra.getAgent('helper');
  return await agent.generate('help me'); // Just works here too!

  // Custom spans work everywhere
  const dbSpan = aiTracingContext.currentAISpan.createChildSpan({
    type: AISpanType.GENERIC,
    name: 'database-query',
  });
}
```

## Methods to be Wrapped

### Mastra Methods

- `getAgent(name)` - Returns tracing-aware agent
- `getAgentById(id)` - Returns tracing-aware agent
- `getWorkflow(id)` - Returns tracing-aware workflow
- `getWorkflowById(id)` - Returns tracing-aware workflow

### Agent Methods (wrapped instances)

- `generate()` - All overloads preserved
- `stream()` - All overloads preserved
- `streamV2()` - All overloads preserved

### Workflow Methods (wrapped instances)

- `execute()` - Pass tracing context to child workflows
- `stream()` - Pass tracing context to child workflows

## Dependencies

- Requires existing AI tracing infrastructure
- No new external dependencies
- Backward compatible with existing code

## Rollout Plan

1. **Phase 1**: Implement core infrastructure and basic wrapping
2. **Phase 2**: Integrate with workflow execution engine
3. **Phase 3**: Add comprehensive error handling
4. **Phase 4**: Add extensive test coverage

## Success Criteria

- [ ] Users no longer need to manually pass `aiTracingContext` to agent/workflow methods in any execution context
- [ ] All existing functionality preserved with full type safety across all contexts
- [ ] Manual span creation available for power users in any execution context
- [ ] Comprehensive test coverage for all integration points
- [ ] Zero breaking changes to existing code
- [ ] Graceful handling of tracing failures
- [ ] Universal coverage wherever Mastra is provided to user code within a span
- [ ] Automatic context detection - no wrapping when tracing is disabled or using NoOp spans

## Future Considerations

- **Additional Integration Points**: Identify other places where Mastra is provided to user code that may need wrapping
- **Performance**: Monitor proxy overhead in high-throughput scenarios across all execution contexts
- **Debugging**: Add development-mode debugging aids to help identify tracing issues
- **Metrics**: Track adoption and usage patterns across different execution contexts
