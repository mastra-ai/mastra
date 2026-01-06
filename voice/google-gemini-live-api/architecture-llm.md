# Architecture Reference: Google Gemini Live Voice API Package

This document provides a comprehensive architecture reference for LLMs working with `@mastra/voice-google-gemini-live`.

## Package Overview

**Purpose**: Wrapper for Google's Gemini Live API providing real-time multimodal voice interactions  
**Base Class**: Extends `MastraVoice` from `@mastra/core/voice`  
**Key Capabilities**: Bidirectional audio streaming, tool calling, VAD, session management, multi-auth support

## Core Architecture

### Main Class Structure

```typescript
class GeminiLiveVoice extends MastraVoice<
  GeminiLiveVoiceConfig,      // Configuration
  GeminiLiveVoiceOptions,     // Runtime options
  GeminiLiveVoiceOptions,     // Additional options
  ToolsInput,                 // Tools type
  GeminiLiveEventMap          // Event map
>
```

### Component Hierarchy

- **GeminiLiveVoice** (Main orchestrator)
  - **AuthManager**: Handles API key and OAuth authentication
  - **ConnectionManager**: Manages WebSocket lifecycle
  - **AudioStreamManager**: Processes audio streams
  - **ContextManager**: Tracks conversation history
  - **EventManager**: Type-safe event emission system
  - **SessionManager**: Session creation and resumption

### File Structure

```
src/
├── index.ts                    # Main GeminiLiveVoice class
├── types.ts                    # Type definitions
├── utils/errors.ts            # Error handling
└── managers/
    ├── AudioStreamManager.ts  # Audio processing
    ├── AuthManager.ts         # Authentication
    ├── ConnectionManager.ts   # WebSocket management
    ├── ContextManager.ts      # Conversation context
    ├── EventManager.ts        # Event system
    └── SessionManager.ts      # Session lifecycle
```

## Key Managers

### AuthManager

**Responsibility**: Authentication for both Gemini API and Vertex AI

**Authentication Methods**:

1. API Key (Gemini API): Header `x-goog-api-key`
2. OAuth (Vertex AI): Bearer token with Google Auth library

**Token Caching**: 50-minute cache for OAuth tokens (60-minute expiry)

**Key Methods**:

- `initialize()`: Set up auth client
- `getAccessToken()`: Get cached or fresh OAuth token
- `clearCache()`: Clear token cache

### ConnectionManager

**Responsibility**: WebSocket connection lifecycle

**States**: `disconnected` → `connecting` → `connected` → `disconnected`

**Key Methods**:

- `setWebSocket(ws)`: Store WebSocket instance
- `waitForOpen()`: Promise-based connection wait (30s timeout)
- `send(data)`: Validated send operation
- `isConnected()`: Check WebSocket.OPEN state

### AudioStreamManager

**Responsibility**: Audio format conversion and stream management

**Audio Config**:

- Input: 16kHz, PCM16, mono
- Output: 24kHz, PCM16, mono

**Limits**:

- Max 10 concurrent speaker streams
- 30s stream timeout
- 32KB max chunk size
- 50MB max buffer
- 5 minutes max duration

**Key Methods**:

- `processAudioChunk(chunk)`: Convert Buffer → Int16Array → Base64
- `createAudioMessage(data, type)`: Wrap audio in API format
- `createSpeakerStream(id)`: Create PassThrough stream for response
- `cleanupSpeakerStreams()`: Remove all active streams

### ContextManager

**Responsibility**: Conversation history with optional compression

**Context Entry**:

```typescript
{ role: 'user' | 'assistant', content: string, timestamp: number }
```

**Limits**:

- Max 100 entries
- Max 10KB per entry
- Compression at 50 entries (keep first/last 1/3, compress middle)

**Key Methods**:

- `addEntry(role, content)`: Add with auto-truncation
- `getContextHistory()`: Get full history
- `compressContext()`: Smart compression
- `clearContext()`: Clear all history

### EventManager

**Responsibility**: Type-safe event system

**Generic Implementation**:

```typescript
class EventManager<TEvents extends EventMap> {
  emit<K extends keyof TEvents>(event: K, data: TEvents[K]): boolean;
  on<E extends keyof TEvents>(event: E, callback: (data: TEvents[E]) => void): void;
  once<E extends keyof TEvents>(event: E, callback: (data: TEvents[E]) => void): void;
}
```

**Features**: Type safety, listener tracking, memory leak prevention, debug logging

## Message Flow

### Connection Flow

1. `connect()` called
2. `AuthManager.initialize()` - get credentials
3. Build WebSocket URL (Gemini API or Vertex AI)
4. Create WebSocket with auth headers
5. `ConnectionManager.waitForOpen()` - wait for OPEN state
6. Send setup message with model, tools, instructions
7. Wait for `setupComplete` message
8. State = `connected`, emit `session` event

### Text Input Flow (speak)

1. Validate connection
2. Add to ContextManager
3. Build `client_content` message
4. Optional: Send `session.update` for runtime options
5. Send via WebSocket
6. Response comes through `serverContent`

### Audio Input Flow (send)

1. Validate connection
2. Process audio chunk (16-bit PCM validation)
3. Convert to base64
4. Wrap in `realtime_input` message
5. Send via WebSocket

### Audio Output Flow

1. Receive `serverContent` message
2. Iterate through `modelTurn.parts[]`
3. For each audio part:
   - Decode base64 → Int16Array
   - Get or create speaker stream by responseId
   - Write to stream
   - Emit `speaker` event (stream) and `speaking` event (chunk)
4. On `turnComplete`: cleanup streams

### Tool Call Flow

**IMPORTANT**: Gemini sends tool calls in TWO formats:

**Format 1** (Legacy - still supported):

```json
{ "toolCall": { "name": "...", "args": {...}, "id": "..." } }
```

**Format 2** (Actual Gemini format):

```json
{
  "serverContent": {
    "modelTurn": {
      "parts": [
        { "functionCall": { "name": "...", "args": {...} } }
      ]
    }
  }
}
```

**Processing**:

1. `handleServerContent` checks each part for `functionCall`
2. Extract name, args, id
3. Convert to internal `toolCall` format
4. Call `handleToolCall()`
5. Find tool in `this.tools`
6. Execute: `tool.execute(args, { requestContext })`
7. Send `tool_result` back to server
8. Gemini incorporates result into response

## Event System

### Event Types

```typescript
interface GeminiLiveEventMap {
  speaker: NodeJS.ReadableStream; // Concatenated audio per response
  speaking: {
    // Individual chunks
    audio?: string; // Base64
    audioData?: Int16Array; // Raw PCM
    sampleRate?: number; // 24000
  };
  writing: {
    text: string;
    role: 'assistant' | 'user';
  };
  session: {
    state: 'connecting' | 'connected' | 'disconnected' | 'disconnecting' | 'updated';
    config?: Record<string, unknown>;
  };
  toolCall: {
    name: string;
    args: Record<string, any>;
    id: string;
  };
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
  usage: { inputTokens; outputTokens; totalTokens; modality };
  turnComplete: { timestamp: number };
  vad: { type: 'start' | 'end'; timestamp };
  interrupt: { type: 'user' | 'model'; timestamp };
}
```

### Event Emission Pattern

```typescript
// Internal
this.emit('speaking', data);

// External
voice.on('speaking', data => {
  /* handle */
});
```

## Tool Integration

### Tool Definition Formats

**Format 1 - Mastra Tool** (via `addTools`):

```typescript
const tool = {
  id: 'getWeather',
  description: 'Get weather',
  inputSchema: z.object({ location: z.string() }),
  execute: async (args, context) => {
    return result;
  },
};
voice.addTools({ getWeather: tool });
```

**Format 2 - Gemini Tool Config** (via constructor):

```typescript
const tools: GeminiToolConfig[] = [
  {
    name: 'getWeather',
    description: 'Get weather',
    parameters: {
      type: 'object',
      properties: { location: { type: 'string' } },
      required: ['location'],
    },
  },
];
const voice = new GeminiLiveVoice({ tools });
```

### Tool Execution

```typescript
// In handleToolCall
const tool = this.tools[toolName];
const result = await tool.execute(toolArgs, { requestContext: this.requestContext });

// Send result back
this.sendEvent('tool_result', {
  tool_result: { tool_call_id: toolId, result },
});
```

### Schema Conversion

Zod schemas automatically converted to JSON Schema:

- `ZodString` → `{ type: 'string' }`
- `ZodNumber` → `{ type: 'number' }`
- `ZodBoolean` → `{ type: 'boolean' }`
- `ZodObject` → `{ type: 'object', properties: {...}, required: [...] }`
- `ZodEnum` → `{ type: 'string', enum: [...] }`

## Error Handling

### Error Codes

```typescript
enum GeminiLiveErrorCode {
  CONNECTION_FAILED,
  CONNECTION_NOT_ESTABLISHED,
  WEBSOCKET_ERROR,
  AUTHENTICATION_FAILED,
  API_KEY_MISSING,
  PROJECT_ID_MISSING,
  AUDIO_PROCESSING_ERROR,
  AUDIO_STREAM_ERROR,
  SPEAKER_STREAM_ERROR,
  INVALID_AUDIO_FORMAT,
  TOOL_EXECUTION_ERROR,
  TOOL_NOT_FOUND,
  SESSION_CONFIG_UPDATE_FAILED,
  SESSION_RESUMPTION_FAILED,
  NOT_CONNECTED,
  INVALID_STATE,
  STREAM_LIMIT_EXCEEDED,
  TRANSCRIPTION_TIMEOUT,
  TRANSCRIPTION_FAILED,
  UNKNOWN_ERROR,
}
```

### Error Creation Pattern

```typescript
createAndEmitError(code, message, details?) {
  const error = new GeminiLiveError(code, message, details);
  this.log(`Error [${code}]: ${message}`, details);
  this.emit('error', error.toEventData());
  return error;
}
```

## Session Management

### Session Properties

- `sessionId`: Unique identifier (UUID)
- `sessionHandle`: For resumption
- `sessionStartTime`: Start timestamp
- `isResuming`: Flag for resumption
- `sessionDurationTimeout`: Duration monitor

### Session Config

```typescript
interface GeminiSessionConfig {
  enableResumption?: boolean; // Save handle for reconnection
  maxDuration?: string; // '24h', '2h', '30m'
  contextCompression?: boolean; // Auto-compress context
  vad?: {
    enabled?: boolean;
    sensitivity?: number; // 0-1
    silenceDurationMs?: number;
  };
  interrupts?: {
    enabled?: boolean;
    allowUserInterruption?: boolean;
  };
}
```

### Resumption Flow

1. Save `sessionHandle` on disconnect (if `enableResumption`)
2. Call `resumeSession(handle, context?)`
3. Set `isResuming = true`
4. On `connect()`, send `session_resume` instead of setup
5. Server validates and restores session

## Design Patterns

### 1. Manager Pattern

Each concern delegated to specialized manager. Benefits: separation of concerns, testability, maintainability.

### 2. Event-Driven Architecture

Loose coupling via typed events. Benefits: flexibility, extensibility, clear data flow.

### 3. Dependency Injection

AudioStreamManager receives sender callback. Benefits: testability, loose coupling.

### 4. Stream Management

PassThrough streams with metadata, limits, and auto-cleanup. Benefits: prevents memory leaks, handles errors.

### 5. Validation Pattern

Consistent validation methods throw typed errors. Benefits: fail fast, clear messages.

### 6. Configuration Normalization

Support multiple config formats internally normalized. Benefits: backward compatibility, flexibility.

## Memory Management

### Stream Cleanup

- Max 10 concurrent streams
- Auto-cleanup after 30s
- Remove oldest when limit exceeded
- Cleanup on disconnect

### Event Listener Cleanup

All listeners removed on `disconnect()` via `eventManager.cleanup()`.

### Context Management

- Max 100 entries
- Truncate long content (10KB)
- Compression or truncation when limit exceeded

### Token Caching

OAuth tokens cached for 50 minutes to avoid expensive requests.

### Buffer Limits

- Audio: 50MB max buffer, 5 minutes max duration
- Chunks: 32KB max size

## WebSocket Message Formats

### Setup (Client → Server)

```json
{
  "setup": {
    "model": "models/gemini-2.0-flash-exp",
    "systemInstruction": { "parts": [{ "text": "..." }] },
    "generationConfig": { "responseModalities": ["AUDIO", "TEXT"], "speechConfig": {...} },
    "tools": [{ "functionDeclarations": [{...}] }]
  }
}
```

### Audio Input (Client → Server)

```json
{
  "realtime_input": {
    "media_chunks": [{ "mime_type": "audio/pcm", "data": "base64..." }]
  }
}
```

### Text Input (Client → Server)

```json
{
  "client_content": {
    "turns": [{ "role": "user", "parts": [{ "text": "..." }] }],
    "turnComplete": true
  }
}
```

### Response (Server → Client)

```json
{
  "serverContent": {
    "modelTurn": {
      "parts": [
        { "text": "..." },
        { "inlineData": { "mimeType": "audio/pcm", "data": "base64..." } },
        { "functionCall": { "name": "getWeather", "args": { "location": "Tokyo" } } }
      ]
    },
    "turnComplete": true
  }
}
```

### Tool Result (Client → Server)

```json
{
  "tool_result": {
    "tool_call_id": "call_123",
    "result": { "temperature": 72 }
  }
}
```

## Key Implementation Details

### Message Handler Routing

```typescript
handleGeminiMessage(data) {
  if (data.setup || data.setupComplete) handleSetupComplete(data);
  else if (data.serverContent) handleServerContent(data.serverContent);
  else if (data.toolCall) handleToolCall(data);
  else if (data.usageMetadata) handleUsageUpdate(data);
  else if (data.error) handleError(data.error);
}
```

### Server Content Processing

```typescript
handleServerContent(data) {
  for (const part of data.modelTurn.parts) {
    if (part.text) emit('writing', { text, role: 'assistant' });
    if (part.functionCall) {
      // Convert to toolCall format and handle
      handleToolCall({ toolCall: { name, args, id } });
    }
    if (part.inlineData?.mimeType?.includes('audio')) {
      // Process audio, emit 'speaking' and 'speaker' events
    }
  }
  if (data.turnComplete) {
    cleanupSpeakerStreams();
    emit('turnComplete', { timestamp });
  }
}
```

### Audio Processing

```typescript
// Input: Buffer → Int16Array → Base64 → WebSocket
processAudioChunk(chunk: Buffer): string {
  const int16Array = new Int16Array(chunk.buffer, chunk.byteOffset, chunk.byteLength / 2);
  return int16ArrayToBase64(int16Array);
}

// Output: Base64 → Int16Array → Buffer → Stream
handleAudioOutput(base64: string) {
  const int16Array = base64ToInt16Array(base64);
  const buffer = Buffer.from(int16Array.buffer);
  speakerStream.write(buffer);
}
```

## Testing Strategy

### Unit Tests

- Mock WebSocket
- Test each manager independently
- Test event emission
- Test audio conversion
- Test tool execution

### Integration Tests

- Connect to real API (requires API key)
- Test full conversation flow
- Test tool calling with real responses
- Test multiple message formats

## Common Patterns for LLMs to Know

### Adding a New Feature

1. Determine which manager should own it
2. Add types to `types.ts`
3. Implement in manager
4. Expose via main class if needed
5. Add events if emitting state changes
6. Add error codes if new failure modes

### Debugging Tool Issues

1. Check `handleServerContent` for `functionCall` detection
2. Verify tool is in `this.tools`
3. Check args are being extracted from message
4. Verify `execute` is called with args as first parameter
5. Check tool result is sent back correctly

### Adding New Message Types

1. Add to `GeminiLiveServerMessage` type
2. Add handler in `handleGeminiMessage`
3. Emit appropriate events
4. Update tests

### Memory Leak Prevention

1. All streams must have error/end/close handlers
2. All event listeners must be removed on cleanup
3. Large buffers must be validated against limits
4. Timers must be cleared on disconnect

## Critical Bug Fixes

### Issue #10161: Tool Arguments Empty

**Problem**: Tool calls triggered but args always `{}`

**Root Cause**: Only checked for top-level `toolCall`, but Gemini sends as `serverContent.modelTurn.parts[].functionCall`

**Fix**:

1. Added `functionCall` to parts type definition
2. Added detection in `handleServerContent`:
   ```typescript
   if (part.functionCall) {
     const toolCallData = { toolCall: { name, args, id } };
     handleToolCall(toolCallData);
   }
   ```

**Key Lesson**: Always check actual API message format, not just documentation.
