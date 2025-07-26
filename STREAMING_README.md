# Vercel AI SDK v5 Streaming Data Converter

A focused TypeScript library for converting incoming data to **Vercel AI SDK v5 streaming format**. This converter specifically handles the new Server-Sent Events (SSE) protocol and streaming architecture introduced in v5.

## 🎯 Focus: Streaming Data Format Only

This converter is specifically designed for the **v5 streaming protocol changes**, not message format conversion. It handles:

- **Server-Sent Events (SSE)** protocol
- **Start/Delta/End** streaming pattern with unique IDs
- **Enhanced streaming** for text, reasoning, tool inputs, sources, and files
- **Stream lifecycle events** and performance monitoring

## 🚀 Key v5 Streaming Changes

| v4 | v5 |
|----|----| 
| Proprietary protocol | **Server-Sent Events (SSE)** |
| Single text chunks | **Start/Delta/End pattern** with IDs |
| Basic streaming | **Enhanced streaming** (reasoning, tool inputs, sources) |
| Simple lifecycle | **Rich lifecycle events** (start, finish-step, finish) |

## 📦 Installation

```bash
npm install ai@beta  # Vercel AI SDK v5
```

Copy the converter file:
- `vercel-ai-sdk-v5-stream-converter.ts`

## ⚡ Quick Start

### Basic Stream Conversion

```typescript
import { 
  VercelAISDKv5StreamConverter, 
  convertToV5StreamPart 
} from './vercel-ai-sdk-v5-stream-converter';

// Convert legacy v4 stream chunk
const legacyChunk = { type: 'text-delta', textDelta: 'Hello world' };
const v5Parts = convertToV5StreamPart(legacyChunk);

// Convert OpenAI stream chunk
const openaiChunk = {
  choices: [{ delta: { content: 'Hello from OpenAI' } }]
};
const converter = new VercelAISDKv5StreamConverter();
const converted = converter.convertOpenAIStreamChunk(openaiChunk);
```

### Create v5 Streams from Scratch

```typescript
import { V5StreamBuilder } from './vercel-ai-sdk-v5-stream-converter';

const stream = new V5StreamBuilder()
  .addText('Processing your request...', 10)
  .addReasoning('Let me think about this step by step...', 20)
  .addToolCall('getWeather', 'call_123', { city: 'SF' })
  .addToolResult('call_123', 'getWeather', { temp: 72, condition: 'sunny' })
  .addSource('url', {
    url: 'https://weather.com',
    title: 'Weather Source',
    description: 'Current weather data'
  })
  .build(); // Returns complete SSE response string
```

## 🔄 Stream Part Types

### Text Streaming (Start/Delta/End Pattern)
```typescript
// v4: Single chunk
{ type: 'text-delta', textDelta: 'Hello' }

// v5: Three-phase pattern with ID
{ type: 'text-start', id: 'text-abc123' }
{ type: 'text-delta', id: 'text-abc123', delta: 'Hello' }
{ type: 'text-end', id: 'text-abc123' }
```

### Reasoning Streaming (New in v5)
```typescript
{ type: 'reasoning-start', id: 'reasoning-xyz' }
{ type: 'reasoning-delta', id: 'reasoning-xyz', delta: 'Let me think...' }
{ type: 'reasoning-end', id: 'reasoning-xyz' }
```

### Tool Input Streaming (New in v5)
```typescript
{ type: 'tool-input-start', id: 'input-123', toolName: 'getWeather', toolCallId: 'call_1' }
{ type: 'tool-input-delta', id: 'input-123', delta: '{"city":' }
{ type: 'tool-input-end', id: 'input-123' }
{ type: 'tool-call', toolCallId: 'call_1', toolName: 'getWeather', input: { city: 'SF' } }
```

### Sources and Citations
```typescript
{
  type: 'source',
  sourceType: 'url',
  id: 'source-1',
  url: 'https://example.com',
  title: 'Example Source',
  description: 'Reference material'
}
```

### File Generation
```typescript
{
  type: 'file',
  mediaType: 'image/jpeg',
  data: 'base64imagedata...',
  url: 'https://generated-image-url.com'
}
```

### Custom Data Parts
```typescript
{
  type: 'data',
  data: { 
    progress: 75, 
    stage: 'processing',
    estimatedTime: '30s'
  }
}
```

## 🌐 Server-Sent Events Format

The converter automatically formats v5 stream parts as SSE:

```typescript
const converter = new VercelAISDKv5StreamConverter();

// Convert to SSE event
const part = { type: 'text-delta', id: 'text-1', delta: 'Hello' };
const sseEvent = converter.toServerSentEvent(part);
const sseString = converter.formatSSEEvent(sseEvent);

// Output:
// id: evt-abc123
// event: stream-part
// data: {"type":"text-delta","id":"text-1","delta":"Hello"}
//
```

## 🔧 Real-world Integration Examples

### API Route Pattern

```typescript
// app/api/chat/route.ts
import { VercelAISDKv5StreamConverter } from './stream-converter';

export async function POST(req: Request) {
  const converter = new VercelAISDKv5StreamConverter();
  
  // Process incoming stream and convert to v5
  const response = new Response(
    new ReadableStream({
      start(controller) {
        // Convert and send v5 stream parts
        const textParts = converter.createTextStream(
          'AI response text here...', 
          50 // chunk size
        );
        
        textParts.forEach(part => {
          const sse = converter.toServerSentEvent(part);
          const formatted = converter.formatSSEEvent(sse);
          controller.enqueue(new TextEncoder().encode(formatted));
        });
        
        controller.close();
      }
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    }
  );
  
  return response;
}
```

### Frontend Stream Consumer

```typescript
// components/StreamingChat.tsx
function StreamingChat() {
  const [streamParts, setStreamParts] = useState<V5StreamPart[]>([]);
  
  useEffect(() => {
    const eventSource = new EventSource('/api/chat');
    
    eventSource.addEventListener('stream-part', (event) => {
      const part: V5StreamPart = JSON.parse(event.data);
      
      setStreamParts(prev => [...prev, part]);
      
      // Handle different part types
      switch (part.type) {
        case 'text-delta':
          // Update text display
          break;
        case 'reasoning-delta':
          // Update reasoning display
          break;
        case 'tool-call':
          // Show tool execution
          break;
        case 'source':
          // Display citation
          break;
        case 'file':
          // Show generated file
          break;
      }
    });
    
    return () => eventSource.close();
  }, []);
  
  // Render stream parts...
}
```

## ⚙️ Advanced Configuration

```typescript
const converter = new VercelAISDKv5StreamConverter({
  generateId: () => `custom-${Date.now()}`,
  enableCompression: true,
  bufferSize: 2048,
  includeMetadata: true
});
```

## 🔄 Legacy Migration

### From v4 Streaming

```typescript
// v4 stream processor
function processV4Stream(legacyChunks: LegacyStreamPart[]) {
  const converter = new VercelAISDKv5StreamConverter();
  const v5Response = '';
  
  legacyChunks.forEach(chunk => {
    const v5Parts = converter.convertLegacyStreamPart(chunk);
    v5Parts.forEach(part => {
      const sse = converter.toServerSentEvent(part);
      v5Response += converter.formatSSEEvent(sse);
    });
  });
  
  return v5Response;
}
```

### From OpenAI Streaming

```typescript
// OpenAI stream processor
async function processOpenAIStream(openaiStream: AsyncIterable<any>) {
  const converter = new VercelAISDKv5StreamConverter();
  
  for await (const chunk of openaiStream) {
    const v5Parts = converter.convertOpenAIStreamChunk(chunk);
    // Send v5Parts via SSE to client
  }
}
```

## 🎯 Performance Optimization

### Chunking Strategy
```typescript
// Adjust chunk sizes based on content type
const textStream = converter.createTextStream(longText, 100);     // Larger chunks for text
const reasoningStream = converter.createReasoningStream(reasoning, 50); // Smaller for reasoning
const toolStream = converter.createToolInputStream(name, id, input, 200); // Larger for JSON
```

### Stream Management
```typescript
// Finalize active streams when done
const converter = new VercelAISDKv5StreamConverter();
// ... create streams ...
const finalizeParts = converter.finalizeActiveStreams();
```

## 📊 Monitoring and Analytics

```typescript
const performanceStream = new V5StreamBuilder()
  .addData({ type: 'metrics', timestamp: Date.now(), stage: 'start' })
  .addText('Processing...', 20)
  .addData({ type: 'metrics', timestamp: Date.now(), stage: 'complete', duration: 1250 })
  .build();
```

## ⚠️ Error Handling

```typescript
const errorStream = new V5StreamBuilder()
  .addText('Starting operation...', 15)
  .addToolResult('call_1', 'operation', { error: 'Timeout' }, true) // isError: true
  .addData({ type: 'error', message: 'Retrying...', retryable: true })
  .build();
```

## 🚦 Stream Lifecycle

Every v5 stream includes lifecycle events:

```typescript
// Automatic lifecycle in createStreamingResponse()
const response = converter.createStreamingResponse([
  // ... your stream parts ...
]);

// Includes:
// { type: 'start' }           - Stream begins
// ... your parts ...          - Content parts
// { type: 'finish' }          - Stream complete
```

## 🔧 Utilities

### Quick Conversions
```typescript
import { convertToV5StreamPart, convertToSSE, createStreamingTextResponse } from './converter';

// Quick legacy conversion
const v5Parts = convertToV5StreamPart(legacyChunk);

// Quick SSE formatting  
const sseString = convertToSSE(v5Part);

// Quick text streaming
const textResponse = createStreamingTextResponse('Hello world!', 10);
```

## 📚 Complete Examples

See `stream-examples.ts` for comprehensive examples including:
- Legacy v4 → v5 conversion
- OpenAI → v5 conversion  
- Complex multi-modal streaming
- Error handling patterns
- Performance monitoring
- Real-time API integration

## 🎯 Use Cases

✅ **Perfect for:**
- Converting legacy streaming formats to v5
- Real-time AI chat applications
- Multi-modal content streaming  
- Tool execution with progress updates
- File generation with streaming
- Source citation and references
- Performance monitoring and analytics

❌ **Not for:**
- Message format conversion (use the message converter instead)
- Static content transformation
- Non-streaming data processing

## 🤝 Contributing

1. Focus on streaming protocol improvements
2. Add support for new stream part types
3. Improve SSE formatting and performance
4. Add more real-world integration examples

## 📄 License

MIT License

---

**Ready to stream with v5?** 🚀

This converter handles all the v5 streaming complexity so you can focus on building amazing AI experiences!