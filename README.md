# Vercel AI SDK v5 Data Format Converter

A comprehensive TypeScript library for converting various data formats to Vercel AI SDK v5 format, supporting both UIMessage (for frontend display) and ModelMessage (for AI models).

## Overview

Vercel AI SDK v5 introduces significant changes to the message format, moving from a simple `content` string to a more structured `parts` array. This converter helps you migrate from v4 and other formats to v5 seamlessly.

## Key Changes in v5

- **Parts-based Architecture**: Messages now use a `parts` array instead of a `content` string
- **UIMessage vs ModelMessage**: Separate types for frontend display and AI model consumption
- **Type-safe Tool Calls**: Tool parts use specific naming: `tool-${toolName}`
- **Media Type Updates**: `mimeType` renamed to `mediaType`
- **Reasoning Support**: Dedicated reasoning part type for reasoning models
- **Enhanced Streaming**: Support for custom data parts and sources

## Installation

```bash
npm install ai@beta  # Vercel AI SDK v5
```

Then copy the converter files to your project:
- `ai-sdk-v5-converter.ts`
- `examples.ts` (optional)

## Quick Start

### Basic Conversion

```typescript
import { convertToUIMessage, convertToModelMessage } from './ai-sdk-v5-converter';

// Convert legacy v4 message
const legacyMessage = {
  id: 'msg-1',
  role: 'user',
  content: 'Hello AI!',
  experimental_attachments: [{
    name: 'image.jpg',
    contentType: 'image/jpeg',
    url: 'data:image/jpeg;base64,/9j/4AAQ...'
  }]
};

// For frontend display
const uiMessage = convertToUIMessage(legacyMessage);

// For AI model processing
const modelMessage = convertToModelMessage(legacyMessage);
```

### OpenAI Format Conversion

```typescript
const openaiMessage = {
  role: 'user',
  content: [
    { type: 'text', text: 'What do you see in this image?' },
    { type: 'image_url', image_url: { url: 'https://example.com/image.jpg' } }
  ]
};

const converted = convertToUIMessage(openaiMessage);
```

## Advanced Usage

### Using the Converter Class

```typescript
import { VercelAISDKv5Converter } from './ai-sdk-v5-converter';

const converter = new VercelAISDKv5Converter({
  generateId: () => `custom-${Date.now()}`,
  includeTimestamp: true,
  preserveOriginalId: false,
  defaultMediaType: 'application/json'
});

const converted = converter.toUIMessage(inputMessage);
```

### Creating Custom Parts

```typescript
// Data parts for streaming UI updates
const dataPart = converter.createDataPart('progress', {
  step: 2,
  message: 'Processing...'
});

// Source parts for citations
const sourcePart = converter.createSourcePart('url', {
  url: 'https://example.com',
  title: 'Example Source',
  description: 'Reference material'
});

// Reasoning parts for reasoning models
const reasoningPart = converter.createReasoningPart(
  'Let me think about this step by step...'
);
```

## Message Types

### UIMessage (Frontend Display)

UIMessages are designed for frontend display and include:
- Full conversation history
- Metadata and timestamps
- UI-specific parts (data, progress indicators)
- Type-safe tool parts

```typescript
interface UIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: UIMessagePart[];
  metadata?: any;
  createdAt?: Date;
}
```

### ModelMessage (AI Processing)

ModelMessages are optimized for AI model consumption:
- Token-efficient format
- Simplified structure
- No UI-specific metadata

```typescript
interface ModelMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | Array<TextPart | ImagePart | FilePart | ToolCallPart | ToolResultPart>;
}
```

## Part Types

### Text Parts
```typescript
{ type: 'text', text: 'Hello world' }
```

### Image Parts
```typescript
{
  type: 'image',
  image: 'https://example.com/image.jpg',
  mediaType: 'image/jpeg'
}
```

### File Parts
```typescript
{
  type: 'file',
  data: 'base64data...',
  mediaType: 'application/pdf'
}
```

### Tool Parts (Type-safe)
```typescript
{
  type: 'tool-getWeather',
  state: 'output-available',
  toolCallId: 'call_123',
  toolName: 'getWeather',
  input: { city: 'SF' },
  output: { temperature: 72 }
}
```

### Reasoning Parts
```typescript
{
  type: 'reasoning',
  text: 'Let me analyze this step by step...'
}
```

### Source Parts
```typescript
{
  type: 'source',
  sourceType: 'url',
  id: 'source-1',
  url: 'https://example.com',
  title: 'Example Source'
}
```

### Data Parts (Custom Streaming)
```typescript
{
  type: 'data-progress',
  id: 'progress-1',
  data: { step: 2, message: 'Processing...' }
}
```

## Migration Guide

### From v4 to v5

1. **Message Structure**: Replace `content` with `parts` array
2. **Attachments**: Convert `experimental_attachments` to file parts
3. **Tool Invocations**: Update to type-safe tool parts
4. **Media Types**: Change `mimeType` to `mediaType`
5. **Reasoning**: Move reasoning to separate part

### Tool State Mapping

| v4 State | v5 State |
|----------|----------|
| `partial-call` | `input-streaming` |
| `call` | `input-available` |
| `result` | `output-available` |
| Error | `output-error` |

## Real-world Examples

### API Route Integration

```typescript
// app/api/chat/route.ts
import { convertToModelMessages, convertToUIMessage } from './converter';

export async function POST(req: Request) {
  const { messages } = await req.json();
  
  // Convert for AI model
  const modelMessages = convertToModelMessages(messages);
  
  const result = streamText({
    model: openai('gpt-4'),
    messages: modelMessages,
  });
  
  return result.toUIMessageStreamResponse();
}
```

### Frontend Component

```typescript
// components/Chat.tsx
import { useChat } from '@ai-sdk/react';
import { UIMessage } from './converter';

export function Chat() {
  const { messages } = useChat();
  
  return (
    <div>
      {messages.map((message: UIMessage) => (
        <div key={message.id}>
          {message.parts.map((part, index) => {
            switch (part.type) {
              case 'text':
                return <p key={index}>{part.text}</p>;
              case 'image':
                return <img key={index} src={part.image} />;
              case 'tool-getWeather':
                return <WeatherWidget key={index} data={part.output} />;
              case 'reasoning':
                return <ReasoningBox key={index} text={part.text} />;
              default:
                return null;
            }
          })}
        </div>
      ))}
    </div>
  );
}
```

### Error Handling

```typescript
try {
  const converted = convertToUIMessage(unknownInput);
} catch (error) {
  console.error('Conversion failed:', error);
  // Fallback logic
}
```

## Configuration Options

```typescript
interface ConversionOptions {
  generateId?: () => string;        // Custom ID generator
  includeTimestamp?: boolean;       // Add createdAt timestamp
  preserveOriginalId?: boolean;     // Keep original message ID
  defaultMediaType?: string;        // Default for unknown file types
}
```

## Type Safety

The converter provides full TypeScript support with:
- Generic metadata types
- Tool-specific part types
- Strict type checking
- IntelliSense support

```typescript
interface CustomMetadata {
  model: string;
  duration: number;
  tokenUsage: { total: number };
}

const message = convertToUIMessage<CustomMetadata>(input, {}, metadata);
```

## Best Practices

1. **Always convert to ModelMessage for AI processing**
2. **Use UIMessage for frontend display and storage**
3. **Preserve original IDs when migrating**
4. **Handle errors gracefully with try-catch**
5. **Use type-safe tool parts for better UX**
6. **Include metadata for debugging and analytics**

## Troubleshooting

### Common Issues

1. **Missing generateId**: Install `ai` package for `generateId` function
2. **Type errors**: Ensure TypeScript types are properly imported
3. **Tool conversion**: Check tool state mapping for v4 to v5 migration
4. **Media types**: Update `mimeType` to `mediaType` in file parts

### Debug Mode

```typescript
const converter = new VercelAISDKv5Converter({
  generateId: () => {
    const id = generateId();
    console.log('Generated ID:', id);
    return id;
  }
});
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure TypeScript types are correct
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Resources

- [Vercel AI SDK v5 Documentation](https://sdk.vercel.ai/docs)
- [Migration Guide](https://sdk.vercel.ai/docs/migration-guides/migrate-ai-sdk-4-0-to-5-0-beta)
- [Examples Repository](./examples.ts)

## Support

For issues and questions:
1. Check the examples file
2. Review the migration guide
3. Open an issue on GitHub
4. Join the Vercel Discord community
