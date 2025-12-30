> API reference for the Processor interface in Mastra, which defines the contract for transforming, validating, and controlling messages in agent pipelines.

# Processor Interface

The `Processor` interface defines the contract for all processors in Mastra. Processors can implement one or more methods to handle different stages of the agent execution pipeline.

## When processor methods run

The five processor methods run at different points in the agent execution lifecycle:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Agent Execution Flow                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User Input                                                     │
│      │                                                          │
│      ▼                                                          │
│  ┌─────────────────┐                                            │
│  │  processInput   │  ← Runs ONCE at start                      │
│  └────────┬────────┘                                            │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   Agentic Loop                          │    │
│  │  ┌─────────────────────┐                                │    │
│  │  │  processInputStep   │  ← Runs at EACH step           │    │
│  │  └──────────┬──────────┘                                │    │
│  │             │                                           │    │
│  │             ▼                                           │    │
│  │       LLM Execution                                     │    │
│  │             │                                           │    │
│  │             ▼                                           │    │
│  │  ┌──────────────────────┐                               │    │
│  │  │ processOutputStream  │  ← Runs on EACH stream chunk  │    │
│  │  └──────────┬───────────┘                               │    │
│  │             │                                           │    │
│  │             ▼                                           │    │
│  │  ┌──────────────────────┐                               │    │
│  │  │  processOutputStep   │  ← Runs after EACH LLM step   │    │
│  │  └──────────┬───────────┘                               │    │
│  │             │                                           │    │
│  │             ▼                                           │    │
│  │     Tool Execution (if needed)                          │    │
│  │             │                                           │    │
│  │             └──────── Loop back if tools called ────────│    │
│  └─────────────────────────────────────────────────────────┘    │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────────┐                                        │
│  │ processOutputResult │  ← Runs ONCE after completion          │
│  └─────────────────────┘                                        │
│           │                                                     │
│           ▼                                                     │
│     Final Response                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

| Method                | When it runs                                           | Use case                                                      |
| --------------------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| `processInput`        | Once at the start, before the agentic loop             | Validate/transform initial user input, add context            |
| `processInputStep`    | At each step of the agentic loop, before each LLM call | Transform messages between steps, handle tool results         |
| `processOutputStream` | On each streaming chunk during LLM response            | Filter/modify streaming content, detect patterns in real-time |
| `processOutputStep`   | After each LLM response, before tool execution         | Validate output quality, implement guardrails with retry      |
| `processOutputResult` | Once after generation completes                        | Post-process final response, log results                      |

## Interface definition

```typescript
interface Processor<TId extends string = string> {
  readonly id: TId;
  readonly name?: string;

  processInput?(args: ProcessInputArgs): Promise<ProcessInputResult> | ProcessInputResult;
  processInputStep?(args: ProcessInputStepArgs): ProcessorMessageResult;
  processOutputStream?(args: ProcessOutputStreamArgs): Promise<ChunkType | null | undefined>;
  processOutputStep?(args: ProcessOutputStepArgs): ProcessorMessageResult;
  processOutputResult?(args: ProcessOutputResultArgs): ProcessorMessageResult;
}
```

## Properties

## Methods

### processInput

Processes input messages before they are sent to the LLM. Runs once at the start of agent execution.

```typescript
processInput?(args: ProcessInputArgs): Promise<ProcessInputResult> | ProcessInputResult;
```

#### ProcessInputArgs

#### ProcessInputResult

The method can return one of three types:

---

### processInputStep

Processes input messages at each step of the agentic loop, before they are sent to the LLM. Unlike `processInput` which runs once at the start, this runs at every step including tool call continuations.

```typescript
processInputStep?(args: ProcessInputStepArgs): ProcessorMessageResult;
```

#### Execution order in the agentic loop

1. `processInput` (once at start)
2. `processInputStep` from inputProcessors (at each step, before LLM call)
3. `prepareStep` callback (runs as part of the processInputStep pipeline, after inputProcessors)
4. LLM execution
5. Tool execution (if needed)
6. Repeat from step 2 if tools were called

#### ProcessInputStepArgs

#### ProcessInputStepResult

The method can return any combination of these properties:

#### Processor chaining

When multiple processors implement `processInputStep`, they run in order and changes chain through:

```
Processor 1: receives { model: 'gpt-4o' } → returns { model: 'gpt-4o-mini' }
Processor 2: receives { model: 'gpt-4o-mini' } → returns { toolChoice: 'none' }
Final: model = 'gpt-4o-mini', toolChoice = 'none'
```

#### System message isolation

System messages are **reset to their original values** at the start of each step. Modifications made in `processInputStep` only affect the current step, not subsequent steps.

#### Use cases

- Dynamic model switching based on step number or context
- Disabling tools after a certain number of steps
- Dynamically adding or replacing tools based on conversation context
- Transforming message part types between providers (e.g., `reasoning` → `thinking` for Anthropic)
- Modifying messages based on step number or accumulated context
- Adding step-specific system instructions
- Adjusting provider options per step (e.g., cache control)
- Modifying structured output schema based on step context

---

### processOutputStream

Processes streaming output chunks with built-in state management. Allows processors to accumulate chunks and make decisions based on larger context.

```typescript
processOutputStream?(args: ProcessOutputStreamArgs): Promise<ChunkType | null | undefined>;
```

#### ProcessOutputStreamArgs

#### Return value

- Return the `ChunkType` to emit it (possibly modified)
- Return `null` or `undefined` to skip emitting the chunk

---

### processOutputResult

Processes the complete output result after streaming or generation is finished.

```typescript
processOutputResult?(args: ProcessOutputResultArgs): ProcessorMessageResult;
```

#### ProcessOutputResultArgs

---

### processOutputStep

Processes output after each LLM response in the agentic loop, before tool execution. Unlike `processOutputResult` which runs once at the end, this runs at every step. This is the ideal method for implementing guardrails that can trigger retries.

```typescript
processOutputStep?(args: ProcessOutputStepArgs): ProcessorMessageResult;
```

#### ProcessOutputStepArgs

#### Use cases

- Implementing quality guardrails that can request retries
- Validating LLM output before tool execution
- Adding per-step logging or metrics
- Implementing output moderation with retry capability

#### Example: Quality guardrail with retry

```typescript title="src/mastra/processors/quality-guardrail.ts"
import type { Processor } from '@mastra/core';

export class QualityGuardrail implements Processor {
  id = 'quality-guardrail';

  async processOutputStep({ text, abort, retryCount }) {
    const score = await evaluateResponseQuality(text);

    if (score < 0.7) {
      if (retryCount < 3) {
        // Request retry with feedback for the LLM
        abort('Response quality too low. Please provide more detail.', {
          retry: true,
          metadata: { qualityScore: score },
        });
      } else {
        // Max retries reached, block the response
        abort('Response quality too low after multiple attempts.');
      }
    }

    return [];
  }
}
```

## Processor types

Mastra provides type aliases to ensure processors implement the required methods:

```typescript
// Must implement processInput OR processInputStep (or both)
type InputProcessor = Processor & ({ processInput: required } | { processInputStep: required });

// Must implement processOutputStream, processOutputStep, OR processOutputResult (or any combination)
type OutputProcessor = Processor &
  ({ processOutputStream: required } | { processOutputStep: required } | { processOutputResult: required });
```

## Usage examples

### Basic input processor

```typescript title="src/mastra/processors/lowercase.ts"
import type { Processor, MastraDBMessage } from '@mastra/core';

export class LowercaseProcessor implements Processor {
  id = 'lowercase';

  async processInput({ messages }): Promise<MastraDBMessage[]> {
    return messages.map(msg => ({
      ...msg,
      content: {
        ...msg.content,
        parts: msg.content.parts?.map(part =>
          part.type === 'text' ? { ...part, text: part.text.toLowerCase() } : part,
        ),
      },
    }));
  }
}
```

### Per-step processor with processInputStep

```typescript title="src/mastra/processors/dynamic-model.ts"
import type { Processor, ProcessInputStepArgs, ProcessInputStepResult } from '@mastra/core';

export class DynamicModelProcessor implements Processor {
  id = 'dynamic-model';

  async processInputStep({ stepNumber, steps, toolChoice }: ProcessInputStepArgs): Promise<ProcessInputStepResult> {
    // Use a fast model for initial response
    if (stepNumber === 0) {
      return { model: 'openai/gpt-4o-mini' };
    }

    // Switch to powerful model after tool calls
    if (steps.length > 0 && steps[steps.length - 1].toolCalls?.length) {
      return { model: 'openai/gpt-4o' };
    }

    // Disable tools after 5 steps to force completion
    if (stepNumber > 5) {
      return { toolChoice: 'none' };
    }

    return {};
  }
}
```

### Message transformer with processInputStep

```typescript title="src/mastra/processors/reasoning-transformer.ts"
import type { Processor, MastraDBMessage } from '@mastra/core';

export class ReasoningTransformer implements Processor {
  id = 'reasoning-transformer';

  async processInputStep({ messages, messageList }) {
    // Transform reasoning parts to thinking parts at each step
    // This is useful when switching between model providers
    for (const msg of messages) {
      if (msg.role === 'assistant' && msg.content.parts) {
        for (const part of msg.content.parts) {
          if (part.type === 'reasoning') {
            (part as any).type = 'thinking';
          }
        }
      }
    }
    return messageList;
  }
}
```

### Hybrid processor (input and output)

```typescript title="src/mastra/processors/content-filter.ts"
import type { Processor, MastraDBMessage, ChunkType } from '@mastra/core';

export class ContentFilter implements Processor {
  id = 'content-filter';
  private blockedWords: string[];

  constructor(blockedWords: string[]) {
    this.blockedWords = blockedWords;
  }

  async processInput({ messages, abort }): Promise<MastraDBMessage[]> {
    for (const msg of messages) {
      const text = msg.content.parts
        ?.filter(p => p.type === 'text')
        .map(p => p.text)
        .join(' ');

      if (this.blockedWords.some(word => text?.includes(word))) {
        abort('Blocked content detected in input');
      }
    }
    return messages;
  }

  async processOutputStream({ part, abort }): Promise<ChunkType | null> {
    if (part.type === 'text-delta') {
      if (this.blockedWords.some(word => part.textDelta.includes(word))) {
        abort('Blocked content detected in output');
      }
    }
    return part;
  }
}
```

### Stream accumulator with state

```typescript title="src/mastra/processors/word-counter.ts"
import type { Processor, ChunkType } from '@mastra/core';

export class WordCounter implements Processor {
  id = 'word-counter';

  async processOutputStream({ part, state }): Promise<ChunkType> {
    // Initialize state on first chunk
    if (!state.wordCount) {
      state.wordCount = 0;
    }

    // Count words in text chunks
    if (part.type === 'text-delta') {
      const words = part.textDelta.split(/\s+/).filter(Boolean);
      state.wordCount += words.length;
    }

    // Log word count on finish
    if (part.type === 'finish') {
      console.log(`Total words: ${state.wordCount}`);
    }

    return part;
  }
}
```

## Related

- [Processors overview](/docs/v1/agents/processors) - Conceptual guide to processors
- [Guardrails](/docs/v1/agents/guardrails) - Security and validation processors
- [Memory Processors](/docs/v1/memory/memory-processors) - Memory-specific processors
