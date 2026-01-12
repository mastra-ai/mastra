# Processor Enhancements Implementation Plan

## Context

GitHub Issue [#7923](https://github.com/mastra-ai/mastra/issues/7923) requests better guardrail support in Mastra. Users need processors that can not only transform data but also control agent flow (retry with feedback, hard stops, etc.).

## Goals

1. ✅ Extend `abort()` to support retry and strongly-typed metadata
2. ✅ Add `processOutputStep` method for per-step output processing with retry support
3. ✅ Enable processor orchestration via the workflow primitive
4. ✅ Bubble up tripwires from workflows
5. ✅ Implement retry mechanism with feedback to LLM

---

## Implementation Status

### ✅ Phase 1: Extend TripWire and abort() - COMPLETED

**Files Modified:**

- `packages/core/src/agent/trip-wire.ts` - Added `TripWireOptions` with `retry` and `metadata`
- `packages/core/src/processors/index.ts` - Added generic `TTripwireMetadata` to processor interfaces
- `packages/core/src/processors/runner.ts` - Updated abort function signatures
- `packages/core/src/stream/types.ts` - Updated tripwire chunk with metadata, retry flag, processorId

**Key Changes:**

```typescript
// TripWire now supports options
export interface TripWireOptions<TMetadata = unknown> {
  retry?: boolean;
  metadata?: TMetadata;
}

// abort() accepts options
abort("reason", { retry: true, metadata: { score: 0.8 } });

// Tripwire chunks include full metadata
type TripwirePayload = {
  tripwireReason: string;
  retry?: boolean;
  metadata?: unknown;
  processorId?: string;
};
```

### ✅ Phase 2: Add processOutputStep Method - COMPLETED

**Files Modified:**

- `packages/core/src/processors/index.ts` - Added `ProcessOutputStepArgs` and `processOutputStep` method
- `packages/core/src/processors/runner.ts` - Implemented `runProcessOutputStep`
- `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts` - Integrated into agentic loop

**Key Changes:**

```typescript
// New processor method for per-step output processing
interface Processor {
  processOutputStep?(
    args: ProcessOutputStepArgs,
  ): Promise<ProcessOutputStepResult>;
}

interface ProcessOutputStepArgs {
  messages: MastraDBMessage[];
  messageList: MessageList;
  stepNumber: number;
  finishReason?: string;
  toolCalls?: Array<{ toolName: string; toolCallId: string; args: unknown }>;
  text?: string;
  systemMessages: CoreMessage[];
  abort: (reason?: string, options?: TripWireOptions) => never;
  retryCount: number;
}
```

### ✅ Phase 3: Processor Workflow Orchestration - COMPLETED

**Files Modified:**

- `packages/core/src/processors/step-schema.ts` - Created discriminated union schemas for processor phases
- `packages/core/src/workflows/workflow.ts` - Added processor detection and wrapping
- `packages/core/src/processors/runner.ts` - Added workflow execution support
- `packages/core/src/agent/agent.ts` - Auto-converts processor arrays to workflows
- `packages/core/src/mastra/index.ts` - Auto-registers processor workflows

**Key Features:**

1. **Discriminated Union Schema** - Uses `phase` field to determine input type:
   - `'input'` - processInput
   - `'inputStep'` - processInputStep
   - `'outputStream'` - processOutputStream
   - `'outputResult'` - processOutputResult
   - `'outputStep'` - processOutputStep

2. **Auto-Conversion** - Processor arrays automatically wrapped into workflows:

   ```typescript
   const agent = new Agent({
     inputProcessors: [piiDetector, moderator], // Auto-wrapped into workflow
   });
   ```

3. **Direct Workflow Usage** - Processors work directly in workflows:

   ```typescript
   const workflow = createWorkflow({ ... })
     .then(piiDetector.createStep())
     .parallel([toxicityCheck.createStep(), spamCheck.createStep()])
     .commit();
   ```

4. **Auto-Registration** - Processor workflows registered in Mastra with `isProcessorWorkflow: true`

5. **UI Badge** - Processor workflows show "Processor" badge in playground

### ✅ Phase 4: Workflow Tripwire Integration - COMPLETED

**Files Modified:**

- `packages/core/src/workflows/workflow.ts` - TripWire errors bubble up with proper status
- `packages/core/src/workflows/default.ts` - Added 'tripwire' status to workflow results
- `packages/core/src/processors/runner.ts` - Workflows as processors propagate tripwires

**Key Changes:**

```typescript
// Workflow result includes tripwire status
type WorkflowStatus = 'success' | 'failed' | 'suspended' | 'tripwire';

// TripWire errors set status to 'tripwire' instead of 'failed'
if (error instanceof TripWire) {
  return { status: 'tripwire', tripwireReason: error.message, ... };
}
```

### ✅ Phase 5: Retry Mechanism - COMPLETED

**Files Modified:**

- `packages/core/src/agent/agent.ts` - Added `maxProcessorRetries` config
- `packages/core/src/agent/agent.types.ts` - Added to `AgentExecutionOptions`
- `packages/core/src/loop/types.ts` - Added `maxProcessorRetries` to `LoopOptions`
- `packages/core/src/loop/workflows/schema.ts` - Added `processorRetryCount` to iteration data
- `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts` - Retry logic implementation
- `packages/core/src/loop/workflows/agentic-execution/llm-mapping-step.ts` - Preserve `isContinued` on retry
- `packages/core/src/stream/types.ts` - Added `StepTripwireData` interface
- `packages/core/src/stream/aisdk/v5/output-helpers.ts` - Added `tripwire` field to `DefaultStepResult`
- `packages/core/src/stream/base/output.ts` - Calculate text from steps, handle tripwire status

**Key Features:**

1. **Configuration:**

   ```typescript
   const agent = new Agent({
     maxProcessorRetries: 3, // Default: 3
     outputProcessors: [qualityChecker],
   });
   ```

2. **Retry Trigger:**

   ```typescript
   processOutputStep: async ({ text, abort, retryCount }) => {
     if (isLowQuality(text) && retryCount < 2) {
       abort("Response quality too low", { retry: true });
     }
     return [];
   };
   ```

3. **Feedback to LLM:**
   - Feedback added as system message: `[Processor Feedback] Your previous response was not accepted: {reason}. Please try again with the feedback in mind.`

4. **Step Tripwire Data:**
   - Rejected steps have `tripwire` field with message, retry flag, metadata, processorId
   - Step's `.text` returns empty string when tripwire is set
   - `result.text` calculated from steps, excluding rejected ones

5. **Step Reason:**
   - Uses `'tripwire'` (not `'abort'`) for processor-triggered tripwires
   - Uses `'retry'` for retry scenarios
   - Consistent terminology throughout codebase

---

## Example Usage

### Basic Retry Pattern

```typescript
const qualityProcessor = {
  id: "quality-check",
  processOutputStep: async ({ text, abort, retryCount }) => {
    const score = await evaluateQuality(text);
    if (score < 0.7 && retryCount < 2) {
      abort("Response quality too low, please improve", {
        retry: true,
        metadata: { score },
      });
    }
    return [];
  },
};

const agent = new Agent({
  model: "openai/gpt-4o",
  outputProcessors: [qualityProcessor],
  maxProcessorRetries: 3,
});

const result = await agent.generate("Write a poem");
// result.steps[0].tripwire - if first attempt was rejected
// result.steps[1].tripwire - undefined if accepted
// result.text - only includes accepted response
// result.tripwire - true if max retries exceeded
```

### Processor Workflow

```typescript
import { createWorkflow, createStep } from "@mastra/core/workflows";
import {
  ProcessorStepInputSchema,
  ProcessorStepOutputSchema,
} from "@mastra/core/processors";

// Create processor steps
const piiStep = piiDetector.createStep();
const toxicityStep = toxicityChecker.createStep();
const spamStep = spamChecker.createStep();

// Orchestrate with workflow primitives
const moderationWorkflow = createWorkflow({
  id: "content-moderation",
  inputSchema: ProcessorStepInputSchema,
  outputSchema: ProcessorStepOutputSchema,
})
  .then(lengthValidator.createStep())
  .parallel([piiStep, toxicityStep, spamStep])
  .then(languageDetector.createStep())
  .commit();

// Use workflow as input processor
const agent = new Agent({
  model: "openai/gpt-4o",
  inputProcessors: [moderationWorkflow],
});
```

### Branching Workflow

```typescript
const branchingWorkflow = createWorkflow({ ... })
  .then(lengthValidator.createStep())
  .branch([
    // If message contains PII patterns, do PII check
    [
      async ({ inputData }) => {
        const text = JSON.stringify(inputData.messages);
        return text.includes('@') || /\d{3}/.test(text);
      },
      piiStep,
    ],
    // Otherwise, do toxicity check
    [async () => true, toxicityStep],
  ])
  .commit();
```

---

## Technical Details

### Step Reason Values

- `'stop'` - Normal completion
- `'tool-calls'` - Tool calls to execute
- `'tripwire'` - Processor triggered tripwire (not retrying)
- `'retry'` - Processor requested retry (continuing loop)
- `'error'` - Error occurred

### Stream Chunk Types

- `'tripwire'` - Tripwire chunk with payload
- `'step-finish'` - Step completion with tripwire data in steps
- `'finish'` - Stream completion

### Result Structure

```typescript
interface GenerateResult {
  text: string; // Only accepted responses (tripwire steps excluded)
  steps: StepResult[]; // All steps, each may have tripwire data
  tripwire: boolean; // True if final tripwire (max retries exceeded)
  tripwireReason?: string;
}

interface StepResult {
  text: string; // Empty if tripwire set
  tripwire?: {
    message: string;
    retry?: boolean;
    metadata?: unknown;
    processorId?: string;
  };
  // ... other fields
}
```

---

## Files Summary

### Core Processor Files

- `packages/core/src/processors/index.ts` - Processor interfaces and types
- `packages/core/src/processors/runner.ts` - ProcessorRunner with workflow support
- `packages/core/src/processors/step-schema.ts` - Zod schemas for processor workflow steps

### Agent Files

- `packages/core/src/agent/agent.ts` - Agent with processor auto-conversion
- `packages/core/src/agent/agent.types.ts` - AgentConfig with maxProcessorRetries
- `packages/core/src/agent/trip-wire.ts` - TripWire with options

### Loop Files

- `packages/core/src/loop/types.ts` - LoopOptions with maxProcessorRetries
- `packages/core/src/loop/workflows/schema.ts` - LLMIterationData with processorRetryCount
- `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts` - Retry logic
- `packages/core/src/loop/workflows/agentic-execution/llm-mapping-step.ts` - Preserve retry state
- `packages/core/src/loop/workflows/agentic-loop/index.ts` - Step-finish emission
- `packages/core/src/loop/workflows/stream.ts` - Finish chunk emission

### Stream Files

- `packages/core/src/stream/types.ts` - StepTripwireData, LLMStepResult with tripwire
- `packages/core/src/stream/aisdk/v5/output-helpers.ts` - DefaultStepResult with tripwire
- `packages/core/src/stream/base/output.ts` - Text calculation from steps

### Workflow Files

- `packages/core/src/workflows/workflow.ts` - Processor wrapping, tripwire handling
- `packages/core/src/workflows/default.ts` - Tripwire status in results

### Mastra Files

- `packages/core/src/mastra/index.ts` - Processor workflow auto-registration

### UI/Playground Files

- `packages/playground-ui/src/domains/workflows/components/workflow-information.tsx` - Processor badge in workflow detail view
- `packages/playground-ui/src/domains/workflows/components/workflow-table/columns.tsx` - Processor badge in workflow list
- `packages/playground-ui/src/components/assistant-ui/messages/tripwire-notice.tsx` - Tripwire notification component
- `packages/playground-ui/src/components/ui/autoform/zodProvider/default-values.ts` - Default values for processor schemas
- `packages/playground-ui/src/components/ui/autoform/zodProvider/field-type-inference.ts` - Field type inference for schemas

### Client SDK Files

- `client-sdks/client-js/src/types.ts` - Added `isProcessorWorkflow` field to workflow types

---

## UI Enhancements

### Processor Workflow Badge

Processor workflows are visually distinguished in the playground UI with a purple "Processor" badge:

- Shown in workflow list table
- Shown in workflow detail header
- Uses Cpu icon for visual distinction

### Tripwire Visualization

When a tripwire is triggered during agent chat:

- Tripwire notice component displays the reason
- Shows retry information if applicable
- Displays processor ID that triggered the tripwire

### Schema Improvements for Playground Forms

The processor step schemas use discriminated unions for better UI rendering:

- `phase` field determines which fields are shown
- Proper field types for messages, messageList, systemMessages
- Passthrough on object schemas preserves additional fields

### Workflow Run Status

- Added 'tripwire' as a workflow status
- Proper visualization in workflow run details
- Step-level tripwire data visible in step results

---

## Tests

All tests passing in `packages/core/src/agent/agent-processor.test.ts`:

- Retry mechanism tests (3 tests)
- TripWire options tests
- ProcessorId in tripwire tests
- Workflow as processor tests
- And more...

---

## Open Questions (Resolved)

1. **Retry feedback format:** ✅ System message with format: `[Processor Feedback] Your previous response was not accepted: {reason}. Please try again with the feedback in mind.`

2. **Retry scope:** ✅ Global across all processors per generation, tracked via `processorRetryCount`

3. **Workflow processor state:** ✅ Each workflow run gets fresh state, parallel branches share input

4. **Streaming retries:** ✅ Text already streamed is kept in steps with tripwire data, `result.text` only includes accepted responses

5. **Processor workflow schemas:** ✅ Discriminated union based on `phase` field with proper typing per phase
