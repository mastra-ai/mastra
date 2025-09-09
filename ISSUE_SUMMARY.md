# Issue: Disconnect Between Stream and Non-Stream Output Processing

## Problem Description

There is an architectural disconnect in how agent output processors handle streaming vs non-streaming responses. When processors implement both `processOutputStream` and `processOutputResult` methods, the `processOutputResult` method receives the original, unprocessed messages rather than the messages that have been transformed by `processOutputStream` during streaming.

### GitHub Issue Context (#7087)

- **Title**: Memory unaffected by Agent Output Processors
- **Reporter**: sccorby
- **Status**: Attempted fix was made but only works for `processOutputResult`, not `processOutputStream`
- **Impact**: PII redaction, content filtering, and other transformations are not persisted to memory when using streaming

## Current Behavior

### During Streaming (`processOutputStream`)

1. Stream chunks (text-delta, tool-call-delta, etc.) flow through the stream pipeline
2. Each chunk passes through `processOutputStream` in `packages/core/src/stream/base/output.ts:~576`
3. Processors can modify, filter, or block these chunks
4. Modified chunks continue through the stream to the client

### After Streaming / Non-Streaming (`processOutputResult`)

1. Messages are built from the **original** LLM response in the step-finish event (`packages/core/src/stream/base/output.ts:267`)
2. These original messages are stored in the `messageList`
3. `processOutputResult` is called with these original, unprocessed messages (`packages/core/src/agent/index.ts:3635-3765`)
4. Any transformations done by `processOutputStream` are not reflected in these messages

## Code Flow

```typescript
// Stream processing path (output.ts:~570-590)
fullStream.pipeThrough(
  new TransformStream({
    async transform(chunk, controller) {
      if (self.processorRunner) {
        // Processes and modifies individual chunks
        const { part: processedPart } = await self.processorRunner.processPart(chunk, processorStates);
        controller.enqueue(processedPart);
      }
    }
  })
)

// Message construction (output.ts:267)
// Uses original, unprocessed messages from LLM
response: { ...otherMetadata, messages: chunk.payload.messages.nonUser }

// Non-stream processing (agent/index.ts:3635)
const outputProcessorResult = await this.__runOutputProcessors({
  // Gets messages from messageList which contains original, unprocessed content
  messageList: new MessageList(...).add(
    { role: 'assistant', content: [{ type: 'text', text: result.text }] },
    'response'
  )
});
```

## Impact

1. **Inconsistent Processing**: Processors that transform content (e.g., removing PII, scrubbing system prompts) will have their transformations applied to the stream but not to the final stored messages
2. **Double Processing Risk**: Processors might need to implement the same logic twice, once for streaming and once for final messages
3. **Data Integrity**: The messages stored and potentially used for memory, logging, or subsequent interactions don't reflect the transformations applied during streaming

## Example Scenario

If a PII detector processor removes phone numbers during streaming:

- **Stream output**: "Contact me at [REDACTED]" (correctly processed)
- **Final messages passed to `processOutputResult`**: "Contact me at 555-1234" (original, unprocessed)
- **Stored in memory/logs**: "Contact me at 555-1234" (privacy concern)

## Root Cause Analysis

The issue stems from the fact that:

1. **During streaming**: `processOutputStream` modifies individual stream chunks (text-delta, tool-call-delta) as they flow through the stream pipeline
2. **Message construction**: The final messages are built from the ORIGINAL LLM response, not from the accumulated processed chunks
3. **Memory storage**: These original, unprocessed messages are what gets saved to the database

The disconnect happens because:

- Stream processing happens in `packages/core/src/stream/base/output.ts` around line 575
- Message accumulation happens separately using the original payload at line 267
- The processed stream chunks are sent to the client but never used to reconstruct the final messages
- The chunks are processed AFTER they've already been added to the message list

## Potential Solutions

### Option 1: Process Chunks Before Message List Accumulation ✅ (Recommended)

Process the chunks through `processOutputStream` BEFORE they are accumulated into the message list. This ensures that both the streamed output and the stored messages are consistently processed. The processing should happen early in the pipeline, before the chunks are used to build messages.

### Option 2: Reconstruct Messages from Processed Chunks

Build the final messages from the accumulated processed stream chunks rather than using the original messages from the LLM. This ensures consistency between what the user sees and what gets stored.

### Option 3: Unified Processing Pipeline

Store the transformations applied during streaming and replay them on the final messages, ensuring consistency.

### Option 4: Single Processing Point

Only process at the message level after streaming completes, applying transformations once to the complete messages.

## Files Involved

- `packages/core/src/stream/base/output.ts` - Stream chunk processing
- `packages/core/src/processors/runner.ts` - Processor execution logic
- `packages/core/src/agent/index.ts` - Agent's use of processors
- `packages/core/src/agent/message-list/index.ts` - Message storage and retrieval

## Reproduction Steps

1. Create an output processor that implements both `processOutputStream` and `processOutputResult`
2. Have `processOutputStream` modify text content (e.g., replace "foo" with "bar")
3. Log the content received by `processOutputResult`
4. Observe that `processOutputResult` receives the original "foo" text, not the "bar" transformation

## Priority

High - This affects data consistency, privacy (PII handling), and the reliability of output processors in production systems.
