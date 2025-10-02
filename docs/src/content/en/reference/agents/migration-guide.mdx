# Migration Guide: VNext to Standard APIs

## Overview

As of `v 0.20.00`, the `streamVNext()` and `generateVNext()` methods in Mastra agents have been renamed to `stream()` and `generate()` respectively. These are now the standard APIs with full AI SDK v5 compatibility. The original `stream()` and `generate()` methods have been renamed to `streamLegacy()` and `generateLegacy()` to maintain backward compatibility with AI SDK v4.

### Continue using AI SDK v4 models
- Rename all your `stream()` and `generate()` calls to `streamLegacy()` and `generateLegacy()` respectively. No other change is needed.

### Continue using AI SDK v5 models
- Rename all your `streamVNext()` and `generateVNext()` calls to `stream()` and `generate()` respectively. No other change is needed.

### Upgrade from AI SDK v4 models to v5 models

First bump all your model provider packages by a major version. This will ensure that they are all v5 models now. Follow the guide below to understand the differences.

## Key Differences

### 1. Model version support

- **Legacy APIs (`generateLegacy`, `streamLegacy`)**: Only support AI SDK v4 models (specificationVersion: 'v1')
- **Current APIs (`generate`, `stream`)**: Only support AI SDK v5 models (specificationVersion: 'v2')
- This is enforced at runtime with clear error messages

### 2. Return types

#### Legacy methods return AI SDK v4 types

- **`generateLegacy()`**:
  - `GenerateTextResult` or `GenerateObjectResult`

- **`streamLegacy()`**:
  - `StreamTextResult` or `StreamObjectResult`

#### New stream methods return Mastra/AI SDK v5 types

- **`generate()`**:
  - When `format: 'mastra'` (default): Returns `MastraModelOutput.getFullOutput()` result
  - When `format: 'aisdk'`: Returns `AISDKV5OutputStream.getFullOutput()` result (AI SDK v5 compatible)
  - Internally calls `stream()` and awaits `getFullOutput()`

- **`stream()`**:
  - When `format: 'mastra'` (default): Returns `MastraModelOutput<OUTPUT>`
  - When `format: 'aisdk'`: Returns `AISDKV5OutputStream<OUTPUT>` (AI SDK v5 compatible)

#### Format Control

- **Legacy**: No format control, always returns AI SDK v4 types
- **New stream**: Can choose format via `format` option ('mastra' or 'aisdk')

```typescript
// Mastra native format (default)
const result = await agent.stream(messages, {
  format: 'mastra'
});

// AI SDK v5 compatibility
const result = await agent.stream(messages, {
  format: 'aisdk'
});
```

### 3. New Options in Non-Legacy APIs

The following options are available in `stream()` and `generate()` but NOT in their legacy counterparts:

1. **`format`** - Choose between 'mastra' or 'aisdk' output format

```typescript
const result = await agent.stream(messages, {
  format: 'aisdk' // or 'mastra' (default)
});
```

2. **`system`** - Custom system message (separate from instructions)

```typescript
const result = await agent.stream(messages, {
  system: 'You are a helpful assistant'
});
```

3. **`structuredOutput`** - Enhanced structured output with model override and custom options

- If no model is added it will use the agent's default model.
- Error strategy when the object does not conform to the schema is `warn` (log a warning), `error` (throw an error), or `fallback` (return a default fallback value of your choice).

```typescript
const result = await agent.generate(messages, {
  structuredOutput: {
    schema: z.object({
      name: z.string(),
      age: z.number()
    }),
    model: openai('gpt-4o-mini'), // Optional model override for structuring
    errorStrategy: 'fallback',
    fallbackValue: { name: 'unknown', age: 0 },
    instructions: 'Extract user information' // Override default structuring instructions
  }
});
```

4. **`stopWhen`** - Flexible stop conditions (step count, token limit, etc.)

```typescript
const result = await agent.stream(messages, {
  stopWhen: ({ steps, totalTokens }) => steps >= 5 || totalTokens >= 10000
});
```

5. **`providerOptions`** - Provider-specific options (e.g., OpenAI-specific settings)

```typescript
const result = await agent.stream(messages, {
  providerOptions: {
    openai: {
      store: true,
      metadata: { userId: '123' }
    }
  }
});
```

6. **`onChunk`** - Callback for each streaming chunk

```typescript
const result = await agent.stream(messages, {
  onChunk: (chunk) => {
    console.log('Received chunk:', chunk);
  }
});
```

7. **`onError`** - Error callback

```typescript
const result = await agent.stream(messages, {
  onError: (error) => {
    console.error('Stream error:', error);
  }
});
```

8. **`onAbort`** - Abort callback

```typescript
const result = await agent.stream(messages, {
  onAbort: () => {
    console.log('Stream aborted');
  }
});
```

9. **`activeTools`** - Specify which tools are active for this execution

```typescript
const result = await agent.stream(messages, {
  activeTools: ['search', 'calculator'] // Only these tools will be available
});
```

10. **`abortSignal`** - AbortSignal for cancellation

```typescript
const controller = new AbortController();
const result = await agent.stream(messages, {
  abortSignal: controller.signal
});

// Later: controller.abort();
```

11. **`prepareStep`** - Callback before each step in multi-step execution

```typescript
const result = await agent.stream(messages, {
  prepareStep: ({ step, state }) => {
    console.log('About to execute step:', step);
    return { /* modified state */ };
  }
});
```

12. **`requireToolApproval`** - Require approval for all tool calls

```typescript
const result = await agent.stream(messages, {
  requireToolApproval: true
});
```

### 4. Options That Still Exist But Have Been Moved

#### `temperature` and Other Model Settings

Unified in `modelSettings`

```typescript
const result = await agent.stream(messages, {
  modelSettings: {
    temperature: 0.7,
    maxTokens: 1000,
    topP: 0.9
  }
});
```

#### `resourceId` and `threadId`

Moved to memory object.

```typescript
const result = await agent.stream(messages, {
  memory: {
    resource: 'user-123',
    thread: 'thread-456'
  }
});
```

### 5. Options That Are Deprecated or Removed

#### `experimental_output`

Use `structuredOutput` instead to allow for tool calls and an object return.

```typescript
const result = await agent.generate(messages, {
  structuredOutput: {
    schema: z.object({
      summary: z.string()
    })
  }
});
```

#### `output`

The `output` property is deprecated in favor of `structuredOutput`, to achieve the same results use maxSteps 1 with `structuredOutput`.

```typescript
const result = await agent.generate(messages, {
  structuredOutput: {
    schema: {
      z.object({
        name: z.string()
      })
    }
  },
  maxSteps: 1
});
```

#### `memoryOptions` was removed

Use `memory` instead
```typescript
const result = await agent.generate(messages, {
  memory: {
    ...
  }
});
```

### 6. Type Changes

#### `context`

- **Legacy**: `CoreMessage[]`
- **New format**: `ModelMessage[]`

#### `toolChoice` uses the AI SDK v5 `ToolChoice` type

```typescript
type ToolChoice<TOOLS extends Record<string, unknown>> = 'auto' | 'none' | 'required' | {
    type: 'tool';
    toolName: Extract<keyof TOOLS, string>;
};
```


## Migration Checklist

### If you're already using `streamVNext` and `generateVNext`

Just find/replace the methods to `stream` and `generate` respectively.

### If you're using the old `stream` and `generate`

Decide whether you want to upgrade or not. If you don't, just find/replace to `streamLegacy` and `generateLegacy`.

