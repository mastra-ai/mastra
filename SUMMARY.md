# Mastra VNext Streaming and Generation APIs Summary

This document provides a comprehensive summary of the experimental `streamVNext` and `generateVNext` APIs in Mastra, including their functionality, parameters, return types, and differences from legacy APIs. This information will be crucial for documentation updates when these APIs become the standard implementations.

## Overview

Both `streamVNext` and `generateVNext` are experimental APIs that will replace the current `stream` and `generate` methods in Mastra agents. They are designed specifically for V2 models and offer enhanced capabilities including AI SDK v5 compatibility.

## streamVNext API

### Location
- Found in `packages/core/src/agent/agent.ts` (line 3293)
- Also available in client SDKs: `client-sdks/client-js/src/resources/agent.ts`, `client-sdks/client-js/src/resources/workflow.ts`

### Method Signature
```typescript
streamVNext<OUTPUT = unknown, FORMAT extends 'mastra' | 'aisdk' = 'mastra'>(
  messages: MessageListInput,
  streamOptions?: AgentExecutionOptions<OUTPUT, FORMAT>
): Promise<FORMAT extends 'aisdk' ? AISDKV5OutputStream<OUTPUT> : MastraModelOutput<OUTPUT>>
```

### Key Features
- Real-time streaming of agent responses
- Supports both Mastra's native format and AI SDK v5 compatibility
- Designed specifically for V2 models (throws error if used with V1 models)
- Enhanced capabilities for multi-step agent execution tracking

### Input Parameters

#### messages: MessageListInput
Accepts various message formats:
- Core `Message[]` array
- AI SDK compatible messages
- String (converted to user message)
- Object with role/content properties

#### streamOptions: AgentExecutionOptions<OUTPUT, FORMAT>
A comprehensive options object with the following properties:

##### Format Control
- `format`: 'mastra' | 'aisdk' - Controls output format compatibility

##### Memory Configuration
- `memory`: Object with `thread` and `resource` properties for contextual memory

##### Output Control
- `structuredOutput`: Preferred method for schema-based output with properties:
  - `schema`: Zod schema for validation
  - `model`: MastraLanguageModel for structured output
  - `errorStrategy`: 'ignore' | 'retry' | 'throw'
  - `fallbackValue`: Default value if structured output fails
  - `instructions`: Specific instructions for structured output generation

##### Model Settings
- `modelSettings`: Configuration object for model parameters including:
  - `temperature`: Controls randomness of output
  - `maxTokens`: Maximum tokens to generate
  - `topP`: Nucleus sampling parameter
  - `topK`: Top-K sampling parameter
  - `presencePenalty`: Penalty for new tokens
  - `frequencyPenalty`: Penalty for frequent tokens
  - `stopSequences`: Array of stop sequences

##### Provider Options
- `providerOptions`: Provider-specific configuration (e.g., OpenAI's `reasoningEffort`)

##### Execution Control
- `maxSteps`: Maximum number of execution steps
- `stopWhen`: Function to determine when to stop streaming
- `toolChoice`: Controls tool selection behavior
- `toolsets`: Array of toolsets available to the agent
- `clientTools`: Client-side tools available to the agent
- `savePerStep`: Whether to save memory after each step
- `telemetry`: Telemetry configuration options
- `runId`: Identifier for the current run
- `runtimeContext`: Context for runtime execution
- `context`: Additional context for the agent
- `instructions`: Override agent instructions
- `system`: System messages to include
- `scorers`: Array of scorers for evaluation
- `returnScorerData`: Whether to return scorer data
- `tracingContext`: Context for tracing
- `tracingOptions`: Options for tracing
- `prepareStep`: Function to prepare each step

##### Callbacks
- `onStepFinish`: Called after each execution step
- `onFinish`: Called when streaming is complete
- `onChunk`: Called for each streamed chunk
- `onError`: Called when an error occurs
- `onAbort`: Called when the stream is aborted

##### Processors
- `inputProcessors`: Array of input processors
- `outputProcessors`: Array of output processors

### Return Types

#### Mastra Native Format (format: 'mastra')
Returns `MastraModelOutput<OUTPUT>` which provides getters for various output components as `DelayedPromise`s:

- `text`: Final text output
- `reasoning`: Reasoning information
- `reasoningText`: Text representation of reasoning
- `reasoningDetails`: Detailed reasoning information
- `sources`: Array of sources
- `files`: Array of files
- `steps`: Array of execution steps
- `fullStream`: Complete stream of all parts
- `finishReason`: Reason for finishing
- `toolCalls`: Tool calls made during execution
- `toolResults`: Results from tool calls
- `usage`: Usage information
- `warnings`: Array of warnings
- `providerMetadata`: Provider-specific metadata
- `response`: Raw response object
- `request`: Raw request object
- `error`: Error information if any
- `tripwire`: Tripwire information
- `tripwireReason`: Reason for tripwire activation
- `totalUsage`: Cumulative usage information
- `content`: Content representation
- `objectStream`: Stream of structured objects
- `elementStream`: Stream of elements
- `object`: Final structured object

#### AI SDK v5 Format (format: 'aisdk')
Returns `AISDKV5OutputStream<OUTPUT>` which provides AI SDK v5 compatible streaming output:

- `textStream`: Text stream
- `fullStream`: Complete stream of all parts
- `content`: Content representation
- `objectStream`: Stream of structured objects
- `elementStream`: Stream of elements
- `sources`: Array of sources
- `files`: Array of files
- `text`: Final text output
- `object`: Final structured object
- `toolCalls`: Tool calls made during execution
- `toolResults`: Results from tool calls
- `reasoningText`: Text representation of reasoning
- `reasoning`: Reasoning information
- `response`: Raw response object
- `steps`: Array of execution steps
- `tripwire`: Tripwire information
- `tripwireReason`: Reason for tripwire activation
- `error`: Error information if any

Additional methods:
- `toTextStreamResponse()`: Convert to text stream response
- `toUIMessageStreamResponse()`: Convert to UI message stream response
- `toUIMessageStream()`: Convert to UI message stream

## generateVNext API

### Location
- Found in `packages/core/src/agent/agent.ts` (line 3264)
- Also available in client SDKs: `client-sdks/client-js/src/resources/agent.ts`, `client-sdks/client-js/src/resources/workflow.ts`

### Method Signature
```typescript
generateVNext<OUTPUT = unknown, FORMAT extends 'mastra' | 'aisdk' = 'mastra'>(
  messages: MessageListInput,
  options?: AgentExecutionOptions<OUTPUT, FORMAT>
): Promise<Awaited<ReturnType<FORMAT extends 'aisdk' ? AISDKV5OutputStream<OUTPUT>['getFullOutput'] : MastraModelOutput<OUTPUT>['getFullOutput']>>>
```

### Key Features
- Non-streaming generation method that returns complete output
- Calls `streamVNext` internally and awaits its `getFullOutput()`
- Supports both Mastra's native format and AI SDK v5 compatibility
- Designed specifically for V2 models (throws error if used with V1 models)
- Handles tripwire conditions and errors

### Input Parameters
Same as `streamVNext`:
- `messages`: MessageListInput
- `options`: AgentExecutionOptions<OUTPUT, FORMAT>

### Return Types
Returns the full output by awaiting the `getFullOutput()` method of the underlying stream:

#### Mastra Native Format (format: 'mastra')
Returns the resolved output from `MastraModelOutput.getFullOutput()` which contains all the properties listed in the streamVNext return types section.

#### AI SDK v5 Format (format: 'aisdk')
Returns the resolved output from `AISDKV5OutputStream.getFullOutput()` which contains all the properties listed in the streamVNext return types section.

## Differences from Legacy APIs

### Legacy stream() Method
- Located in `packages/core/src/agent/agent.ts` (line 3747)
- Deprecated and will be replaced by `streamVNext` on September 23rd, 2025
- Only supports V1 models
- Uses `AgentStreamOptions` type for options
- Returns different structure than VNext APIs

### Legacy generate() Method
- Located in `packages/core/src/agent/agent.ts` (line 3400)
- Deprecated and will be replaced by `generateVNext` on September 23rd, 2025
- Only supports V1 models
- Uses `AgentGenerateOptions` type for options
- Returns either `GenerateTextResult` or `GenerateObjectResult` depending on schema

### Key Differences in Options

#### AgentExecutionOptions (VNext) vs AgentGenerateOptions/AgentStreamOptions (Legacy)
1. **Format Control**: VNext includes a `format` option ('mastra' | 'aisdk') for compatibility
2. **Structured Output**: VNext uses `structuredOutput` as the preferred method (legacy had both `output` and `structuredOutput`)
3. **Memory**: VNext uses `memory` with `thread` and `resource` properties (legacy had deprecated `memoryOptions`)
4. **Provider Options**: VNext has `providerOptions` for provider-specific configuration
5. **Additional Callbacks**: VNext includes `onChunk`, `onError`, and `onAbort` callbacks
6. **Execution Control**: VNext adds `stopWhen` and `prepareStep` options
7. **Model Settings**: VNext provides a unified `modelSettings` object for model parameters

## Implementation Details

### Model Version Check
Both VNext APIs explicitly check that the underlying LLM model's `specificationVersion` is 'v2', throwing an error if a 'v1' model is used.

### getLLM Method
The `getLLM` method in `packages/core/src/agent/agent.ts` (line 702) is responsible for instantiating either `MastraLLMV1` for v1 models or `MastraLLMVNext` for v2 models, based on the model's `specificationVersion`.

## Usage Examples

### Basic Usage
```typescript
// Mastra native format (default)
const stream = await agent.streamVNext(messages, options);

// AI SDK v5 format
const stream = await agent.streamVNext(messages, { ...options, format: 'aisdk' });
```

### With Structured Output
```typescript
const result = await agent.generateVNext(messages, {
  structuredOutput: {
    schema: z.object({ name: z.string(), age: z.number() }),
    model: openai('gpt-4o'),
    errorStrategy: 'ignore',
    fallbackValue: { name: 'Unknown', age: 0 }
  }
});
```

### With Memory
```typescript
const stream = await agent.streamVNext(messages, {
  memory: {
    thread: 'thread-id',
    resource: 'resource-id'
  }
});
```

### With Callbacks
```typescript
const stream = await agent.streamVNext(messages, {
  onFinish: (result) => console.log('Finished:', result),
  onStepFinish: (step) => console.log('Step finished:', step),
  onChunk: (chunk) => console.log('Chunk received:', chunk)
});
```

## Migration Path

When migrating from legacy APIs to VNext APIs:

1. Replace `agent.stream()` with `agent.streamVNext()`
2. Replace `agent.generate()` with `agent.generateVNext()`
3. Update options to use `structuredOutput` instead of `output`
4. Use `memory` with `thread` and `resource` instead of deprecated `memoryOptions`
5. Add `format: 'aisdk'` option if AI SDK v5 compatibility is needed
6. Ensure models used have `specificationVersion: 'v2'`

## Breaking Changes

When `streamVNext` becomes the new `stream`:

1. Legacy V1 model support will be removed from streaming
2. The `format` option will default to 'mastra' but can be set to 'aisdk' for compatibility
3. All new callback options (`onChunk`, `onError`, `onAbort`) will be available
4. `providerOptions` will be the standard way to configure provider-specific settings
5. `structuredOutput` will be the only method for schema-based output
6. Memory will be configured through the `memory` object with `thread` and `resource` properties