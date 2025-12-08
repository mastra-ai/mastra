# processInputStep Specification

## Overview

`processInputStep` is a processor method that runs at **each step** of the agentic loop, before the LLM is invoked. Unlike `processInput` which runs once at the start, this runs at every step (including tool call continuations).

This enables:

- Per-step message transformations
- Dynamic model/toolChoice switching mid-conversation
- Step-aware logic (e.g., different behavior on step 0 vs step 5)

## Architecture

### Processor Pipeline

When multiple `inputProcessors` are provided, they run **in order**. Each processor can modify the step configuration, and changes **chain through** - each processor receives the accumulated state from previous processors:

```
Step N starts
    │
    ▼
┌─────────────────────┐
│ Processor 1         │ ─── can modify: model, toolChoice, activeTools, messages,
│ processInputStep()  │     systemMessages, providerOptions, modelSettings
└─────────────────────┘
    │ result merged into stepInputResult
    │ next processor receives updated values
    ▼
┌─────────────────────┐
│ Processor 2         │ ─── receives model/toolChoice/etc modified by Processor 1
│ processInputStep()  │
└─────────────────────┘
    │ result merged into stepInputResult
    │ next processor receives updated values
    ▼
    ... more processors ...
    │
    ▼
LLM invoked with final stepInputResult
```

**Chaining behavior**: If Processor 1 returns `{ model: modelA }`, then Processor 2 will receive `model: modelA` in its args (not the original model). This allows processors to build on each other's modifications.

### prepareStep Integration

`prepareStep` is now implemented as `PrepareStepProcessor`, which wraps the user-provided function and runs it through the standard `processInputStep` pipeline.

```typescript
// User provides:
agent.generate({
  prepareStep: async ({ stepNumber, model }) => {
    if (stepNumber > 3) {
      return { toolChoice: 'none' };
    }
  },
});

// Internally becomes:
new PrepareStepProcessor({ prepareStep: userFunction });
```

## API

### ProcessInputStepArgs

Arguments passed to `processInputStep`:

```typescript
interface ProcessInputStepArgs<TOOLS extends ToolSet = ToolSet, OUTPUT extends OutputSchema = undefined> {
  // READ-ONLY: Message snapshots
  messages: MastraDBMessage[]; // Current messages snapshot (do not mutate)
  systemMessages: CoreMessageV4[]; // System messages snapshot (do not mutate)

  // MUTABLE: MessageList for making changes
  messageList: MessageList; // Use this to add/remove/modify messages

  // READ-ONLY: Step context
  stepNumber: number; // Current step (0-indexed)
  steps: Array<StepResult<TOOLS>>; // Results from previous steps

  // READ-ONLY: Current configuration (return new values to change)
  model: MastraLanguageModelV2; // Current model
  toolChoice?: ToolChoice<TOOLS>; // Current tool choice
  activeTools?: Array<keyof TOOLS>; // Currently active tools

  // MODIFIABLE: Additional settings (return new values to change)
  providerOptions?: SharedV2ProviderOptions;
  modelSettings?: Omit<CallSettings, 'abortSignal'>;
  structuredOutput?: StructuredOutputOptions<OUTPUT>; // See note below about type complexity

  // Utilities
  abort: (reason?: string) => never; // Abort the entire run
  tracingContext?: TracingContext;
  requestContext?: RequestContext;
}
```

**Read-only vs Mutable:**

- `stepNumber`, `steps` - Read-only context, cannot be changed
- `messages` - Read-only snapshot; return `messages` in result to apply changes
- `systemMessages` - Read-only snapshot of current system messages; return `systemMessages` in result to replace them
- `model`, `toolChoice`, `activeTools` - Read current values; return new values in result to change them
- `providerOptions`, `modelSettings` - Read current values; return new values in result to change them
- `structuredOutput` - Can be modified, but changing OUTPUT type mid-step has type complexity (see TODO)
- `messageList` - Mutable; can use its methods directly OR return `messages` array in result

### ProcessInputStepResult

What `processInputStep` can return:

```typescript
type ProcessInputStepResult<TOOLS extends ToolSet = ToolSet, OUTPUT extends OutputSchema = undefined> = {
  // Model configuration - change the model for this step
  model?: LanguageModelV2 | ModelRouterModelId | OpenAICompatibleConfig | MastraLanguageModelV2;

  // Tool configuration
  toolChoice?: ToolChoice<TOOLS>; // Change tool choice for this step
  activeTools?: Array<keyof TOOLS>; // Change active tools for this step

  // Message modifications (mutually exclusive)
  messages?: MastraDBMessage[]; // Replace messages (system messages in array are ADDED)
  messageList?: MessageList; // Return same messageList (indicates mutations were made)

  // System message modifications
  systemMessages?: CoreMessageV4[]; // REPLACE all system messages with these

  // Additional settings (TODO: full support)
  providerOptions?: SharedV2ProviderOptions;
  modelSettings?: Omit<CallSettings, 'abortSignal'>;
  structuredOutput?: StructuredOutputOptions<OUTPUT>;
};

// Can also return:
// - MessageList (same instance) - indicates you mutated it directly
// - MastraDBMessage[] - replace messages
// - undefined - no changes
```

### Validation Rules

1. **Cannot return external MessageList**: If returning a `MessageList`, it must be the same instance passed in
2. **Cannot return both messages and messageList**: Choose one or the other
3. **v1 models not supported**: Only v2 models can be returned

## Usage Patterns

### 1. Agent Constructor - Default inputProcessors

```typescript
const agent = new Agent({
  name: 'my-agent',
  inputProcessors: [new MyCustomProcessor(), new AnotherProcessor()],
});

// These run on every generate/stream call
agent.generate({ prompt: 'Hello' });
```

### 2. Agent Constructor - Default prepareStep

```typescript
const agent = new Agent({
  name: 'my-agent',
  defaultGenerateOptions: {
    prepareStep: async ({ stepNumber }) => {
      // Runs before each step
    },
  },
});
```

### 3. Per-call inputProcessors

```typescript
agent.generate({
  prompt: 'Hello',
  inputProcessors: [new StepSpecificProcessor()],
});
```

### 4. Per-call prepareStep

```typescript
agent.generate({
  prompt: 'Hello',
  prepareStep: async ({ stepNumber, model, toolChoice }) => {
    if (stepNumber === 0) {
      return { toolChoice: { type: 'tool', toolName: 'searchTool' } };
    }
    if (stepNumber > 5) {
      return { toolChoice: 'none' }; // Stop tool use after 5 steps
    }
  },
});
```

### 5. Dynamic Model Switching

```typescript
agent.generate({
  prompt: 'Complex task',
  prepareStep: async ({ stepNumber }) => {
    if (stepNumber === 0) {
      // Use fast model for initial response
      return { model: 'gpt-4o-mini' };
    }
    // Use powerful model for tool execution
    return { model: 'gpt-4o' };
  },
});
```

### 6. Message Transformation

```typescript
class ReasoningTransformer implements Processor {
  id = 'reasoning-transformer';

  processInputStep({ messages, messageList }) {
    // Transform 'reasoning' content to 'thinking' for Anthropic
    const transformed = messages.map(m => transformReasoning(m));
    return { messages: transformed };
  }
}
```

## Test Plan

### Unit Tests

#### PrepareStepProcessor Tests

- [ ] `prepareStep` function is called with correct args
- [ ] Return value is passed through correctly
- [ ] Works with generic TOOLS types
- [ ] Handles undefined return

#### ProcessorRunner.runProcessInputStep Tests

- [x] Single processor modifies model
- [x] Single processor modifies toolChoice
- [x] Single processor modifies activeTools
- [x] Single processor modifies messages
- [x] Single processor modifies systemMessages
- [x] Multiple processors chain correctly (output of one affects next)
- [x] Processor can abort the run
- [x] Error in processor stops the chain
- [x] MessageList mutations are tracked correctly
- [x] Validation: rejects external MessageList
- [x] Validation: rejects messages + messageList together
- [x] Validation: rejects v1 models

### Integration Tests

#### Agent with inputProcessors (constructor)

- [ ] inputProcessors run on every generate call
- [ ] inputProcessors run on every stream call
- [ ] Multiple inputProcessors chain correctly
- [ ] inputProcessors receive correct step context

#### Agent with prepareStep (defaultGenerateOptions)

- [ ] prepareStep runs on every generate call
- [ ] prepareStep runs on every stream call
- [ ] prepareStep can modify model
- [ ] prepareStep can modify toolChoice
- [ ] prepareStep can modify activeTools

#### Agent.generate with inputProcessors

- [ ] Per-call inputProcessors **replace** constructor inputProcessors (not extend)
- [ ] Per-call inputProcessors receive correct args
- [ ] Constructor inputProcessors are NOT called when per-call inputProcessors provided

#### Agent.generate with prepareStep

- [ ] Per-call prepareStep works
- [ ] Per-call prepareStep overrides defaultGenerateOptions.prepareStep

#### Agent.stream with inputProcessors

- [ ] Same tests as generate

#### Agent.stream with prepareStep

- [ ] Same tests as generate

### Edge Cases

- [x] stepNumber increments correctly across tool calls
- [x] steps array contains previous step results
- [x] Empty inputProcessors array is handled
- [x] Processor returns nothing (undefined)
- [x] Processor only returns partial result (just toolChoice, not model)

## Implementation Status

### ✅ Completed

1. **providerOptions support**: Pass through and allow modification - chains through multiple processors
2. **modelSettings support**: Pass through and allow modification - chains through multiple processors
3. **Processor chaining**: Each processor receives accumulated state from previous processors (model, toolChoice, activeTools, providerOptions, modelSettings)
4. **Span logging**: Processor spans include all serializable input args and output results
5. **System message isolation**: System messages reset to original at each step; modifications only affect current step
6. **Test coverage**: Comprehensive tests for model/toolChoice/activeTools/providerOptions/modelSettings chaining and edge cases

### ⚠️ Breaking Changes (for 1.0 migration guide)

1. **prepareStep messages format changed**: `prepareStep` used to receive `messages` formatted as AI SDK v5 model messages. Now that it's unified with `processInputStep`, messages are in `MastraDBMessage` format.
   - **Migration**: Use `messageList.get.all.aiV5.model()` if you need the old format
   - Example:
     ```typescript
     prepareStep: async ({ messageList }) => {
       const aiSdkMessages = messageList.get.all.aiV5.model();
       // ... use aiSdkMessages
     };
     ```

### 🔜 Future Work

1. **structuredOutput support**: Partially implemented - can be passed and returned, but:
   - If a processor changes `structuredOutput` to a different schema, the `OUTPUT` type changes
   - This affects the return type of `result.object` and `objectStream`
   - Need to figure out how to handle type inference when OUTPUT changes mid-pipeline
   - Options: (a) don't allow changing schema, only enabling/disabling, (b) use `unknown` for dynamic schemas, (c) require explicit type annotation
2. **tools argument**: Should processors be able to modify the tools themselves? Currently `activeTools` only filters, cannot add new tools.

### 📝 TODO

- [x] Update 1.0 migration guide with prepareStep messages format breaking change (added to docs/src/content/en/guides/migrations/upgrade-to-v1/agent.mdx)
- [x] Update processor docs with processInputStep section (added to docs/src/content/en/docs/agents/processors.mdx)

## System Message Behavior

### Reset at Each Step

System messages are **reset to their original values** at the start of each step. This ensures that modifications made in `prepareStep` or `processInputStep` only affect the current step:

```typescript
// In llm-execution-step.ts (createLLMExecutionStep)
const initialSystemMessages = messageList.getAllSystemMessages();

return createStep({
  // ...
  execute: async () => {
    // Reset at start of each step execution
    if (initialSystemMessages) {
      messageList.replaceAllSystemMessages(initialSystemMessages);
    }
    // ... then run processors
  },
});
```

### Modifying System Messages

There are two ways to modify system messages in `processInputStep`/`prepareStep`:

1. **Return `{ systemMessages }` to REPLACE all system messages**:

   ```typescript
   prepareStep: async ({ systemMessages }) => {
     return {
       systemMessages: [...systemMessages, { role: 'system', content: 'Additional instruction for this step' }],
     };
   };
   ```

2. **Include system messages in returned `messages[]` array to ADD**:
   ```typescript
   prepareStep: async ({ messages }) => {
     return {
       messages: [...messages, { role: 'system', content: 'This gets added via addSystem()' }],
     };
   };
   ```

### Consistency with processInput

Both `processInput` and `processInputStep` handle system messages the same way:

- `{ systemMessages }` in result → **replaces** all system messages
- System role messages in `messages[]` array → **adds** via `messageList.addSystem()`

## Current Implementation Details

### Processor Order (from llm-execution-step.ts)

```typescript
const inputStepProcessors = [
  ...(inputProcessors || []),
  ...(options?.prepareStep ? [new PrepareStepProcessor({ prepareStep: options.prepareStep })] : []),
];
```

**Order**: inputProcessors run first, then prepareStep runs last.

This means:

1. inputProcessors can set up state that prepareStep can react to
2. prepareStep has "final say" on model/toolChoice/activeTools

### Result Application (from llm-execution-step.ts)

After `runProcessInputStep` returns:

```typescript
if (processInputStepResult.model) {
  stepModel = processInputStepResult.model;
}
if (processInputStepResult.toolChoice) {
  stepToolChoice = processInputStepResult.toolChoice;
}
if (processInputStepResult.activeTools && stepTools) {
  const activeToolsSet = new Set(processInputStepResult.activeTools);
  stepTools = Object.fromEntries(
    Object.entries(stepTools).filter(([toolName]) => activeToolsSet.has(toolName)),
  ) as typeof tools;
}

// Re-fetch messages after processors have modified them
inputMessages = await messageList.get.all.aiV5.llmPrompt(messageListPromptArgs);
```

## Open Questions

1. ~~Should per-call inputProcessors replace or extend constructor inputProcessors?~~
   - **Answered**: Per-call inputProcessors **replace** constructor inputProcessors (not extend)
   - Documented in agent.types.ts: "Input processors to use for this execution (overrides agent's default)"

2. ~~Should systemMessages be modifiable via processInputStep?~~
   - **Answered**: Yes, consistent with `processInput`
   - Both `processInput` and `processInputStep` can return `{ systemMessages }` to **replace** all system messages
   - Both methods handle system messages in `messages[]` array the same way: they are **added** (not replaced) via `messageList.addSystem()`
   - **Key difference for processInputStep**: System messages are **reset to original** at the start of each step, so modifications only apply to that step

3. Should `activeTools` filter from available tools, or can it add tools?
   - Currently: filters only (see implementation above)
