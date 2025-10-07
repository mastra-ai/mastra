# Issue #8351: Mastra Server not handling rate limit error for anthropic provider

## Problem Description

When using the Anthropic provider with Mastra agent server, rate limit errors are not handled gracefully. Instead:

1. The server crashes/throws an unhandled exception
2. Returns HTTP 200 OK status (incorrect)
3. The error message is logged but not properly propagated to the client
4. Automatic retry mechanisms fail because they receive a 200 status

## Error Example

```
Error creating stream APICallError [AI_APICallError]: This request would exceed the rate limit for your organization (31979f85-6b37-4d26-b641-19df289835a4) of 30,000 input tokens per minute.
at file:///var/task/mastra.mjs:14932:14
at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
at async postToApi$1 (file:///var/task/mastra.mjs:14790:28)
at async AnthropicMessagesLanguageModel.doStream (file:///var/task/mastra.mjs:83919:50)
```

## Root Cause Analysis

### Current Error Handling Flow

1. **Stream Handler Location**: `/packages/deployer/src/server/handlers/routes/agents/handlers.ts:242-289`
   - The `streamGenerateHandler` function uses Hono's `stream()` helper
   - Inside the stream callback (line 254-280), there's a try-catch block
   - When an error occurs during streaming, it's caught at line 276 and only logged
   - The stream then closes normally (line 280), sending HTTP 200

2. **The Problem**:

   ```typescript
   try {
     const streamResponse = await getOriginalStreamGenerateHandler({...});
     const reader = streamResponse.fullStream.getReader();

     let chunkResult;
     while ((chunkResult = await reader.read()) && !chunkResult.done) {
       await stream.write(`data: ${JSON.stringify(chunkResult.value)}\n\n`);
     }
     await stream.write('data: [DONE]\n\n');
   } catch (err) {
     logger.error('Error in stream generate: ' + ((err as Error)?.message ?? 'Unknown error'));
     // ⚠️ ERROR IS ONLY LOGGED, NOT PROPAGATED TO CLIENT
   }
   await stream.close();  // ⚠️ ALWAYS SENDS 200 OK
   ```

3. **Why Errors Aren't Propagated**:
   - When `getOriginalStreamGenerateHandler` is called (line 256), if the underlying LLM provider throws an error (like rate limit), it gets thrown synchronously or during stream reading
   - The catch block (line 276) only logs the error
   - The stream closes normally with `stream.close()` (line 280)
   - Since the HTTP response headers are already sent (status 200, line 250), there's no way to change the status code
   - The client receives a 200 OK response with an incomplete or empty stream

### Supporting Evidence

1. **Error Chunk Type Exists**: In `/packages/core/src/stream/types.ts:473`, there's an error chunk type:

   ```typescript
   | (BaseChunkType & { type: 'error'; payload: ErrorPayload })
   ```

2. **ErrorPayload Definition** (types.ts:193-196):

   ```typescript
   interface ErrorPayload {
     error: unknown;
     [key: string]: unknown;
   }
   ```

3. **Similar Pattern in Other Handlers**: The same pattern exists in:
   - `approveToolCallHandler` (line 291-340)
   - `declineToolCallHandler` (line 342-389)
   - `streamNetworkHandler` (line 391-464)

## Expected Behavior

1. **Before Stream Starts**: If error occurs before streaming begins, return proper HTTP error status (429 for rate limits, 500 for others)

2. **During Stream**: If error occurs during streaming:
   - Send an error chunk to the client: `data: {"type": "error", "payload": {"error": "..."}}\n\n`
   - Close the stream gracefully
   - The client can detect the error chunk and handle it appropriately

3. **Automatic Retry**: With proper error propagation, automatic retry mechanisms can work correctly

## Relevant Files

1. **Primary Issue**:
   - `/packages/deployer/src/server/handlers/routes/agents/handlers.ts:242-289` (streamGenerateHandler)
   - Similar handlers: lines 291-340 (approveToolCall), 342-389 (declinToolCall), 391-464 (streamNetwork)

2. **Error Handling Utilities**:
   - `/packages/deployer/src/server/handlers/error.ts:8-14` (handleError function)
   - `/packages/server/src/server/handlers/error.ts:6-16` (handleError function)

3. **Stream Types**:
   - `/packages/core/src/stream/types.ts:473` (error chunk type definition)
   - `/packages/core/src/stream/types.ts:193-196` (ErrorPayload interface)

4. **Original Handler**:
   - `/packages/server/src/server/handlers/agents.ts:489-534` (streamGenerateHandler)

## Proposed Solution

### Option 1: Emit Error Chunk (Preferred)

When an error occurs during streaming, emit an error chunk before closing:

```typescript
try {
  // ... stream reading logic
} catch (err) {
  logger.error('Error in stream generate: ' + ((err as Error)?.message ?? 'Unknown error'));

  // Emit error chunk to client
  await stream.write(
    `data: ${JSON.stringify({
      type: 'error',
      from: 'AGENT',
      runId: body.runId || 'unknown',
      payload: {
        error:
          err instanceof Error
            ? {
                message: err.message,
                name: err.name,
                stack: err.stack,
              }
            : String(err),
      },
    })}\n\n`,
  );
}
```

### Option 2: Early Error Detection

Wrap the initial handler call in try-catch and return error response before starting stream:

```typescript
export async function streamGenerateHandler(c: Context): Promise<Response | undefined> {
  try {
    const mastra = c.get('mastra');
    const agentId = c.req.param('agentId');
    const runtimeContext: RuntimeContext = c.get('runtimeContext');
    const body = await c.req.json();
    const logger = mastra.getLogger();

    // Try to create stream response first (before setting headers)
    let streamResponse;
    try {
      streamResponse = await getOriginalStreamGenerateHandler({
        mastra,
        agentId,
        runtimeContext,
        body,
        abortSignal: c.req.raw.signal,
      });
    } catch (err) {
      // Error before streaming starts - can return proper HTTP error
      return handleError(err, 'Error streaming from agent');
    }

    // Now start the actual stream
    c.header('Transfer-Encoding', 'chunked');
    return stream(c, async stream => {
      // ... rest of streaming logic
    });
  } catch (error) {
    return handleError(error, 'Error streaming from agent');
  }
}
```

### Recommended: Combination Approach

1. Detect errors early (before stream starts) and return proper HTTP error
2. For errors during streaming, emit error chunks
3. Apply to all streaming handlers consistently

## Test Plan

1. Create a test that simulates rate limit error from Anthropic
2. Verify error chunk is emitted in the stream
3. Verify stream closes gracefully
4. Test with both early errors (before stream) and mid-stream errors
5. Verify same fix works for all streaming handlers
