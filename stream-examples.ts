/**
 * Vercel AI SDK v5 Streaming Examples
 * 
 * Focused examples showing how to convert and work with
 * the v5 streaming data format and Server-Sent Events.
 */

import {
  VercelAISDKv5StreamConverter,
  V5StreamBuilder,
  convertToV5StreamPart,
  convertToSSE,
  createStreamingTextResponse,
  type V5StreamPart,
  type LegacyStreamPart
} from './vercel-ai-sdk-v5-stream-converter';

// Example 1: Converting Legacy v4 Stream to v5
console.log('=== Example 1: Legacy v4 Stream Conversion ===');

const legacyV4Chunks: LegacyStreamPart[] = [
  { type: 'text-delta', textDelta: 'Hello' },
  { type: 'text-delta', textDelta: ' world' },
  { type: 'text-delta', textDelta: '!' },
  { 
    type: 'tool-call', 
    toolCallId: 'call_123', 
    toolName: 'getWeather', 
    args: { city: 'SF' } 
  },
  { 
    type: 'tool-result', 
    toolCallId: 'call_123', 
    toolName: 'getWeather', 
    result: { temperature: 72, condition: 'sunny' } 
  },
  { type: 'step-finish', finishReason: 'stop' },
  { type: 'finish', usage: { total: 25 } }
];

const converter = new VercelAISDKv5StreamConverter();

legacyV4Chunks.forEach((chunk, index) => {
  const v5Parts = converter.convertLegacyStreamPart(chunk);
  console.log(`Legacy chunk ${index}:`, chunk);
  console.log(`Converted to v5:`, v5Parts);
  console.log('---');
});

// Example 2: Converting OpenAI Streaming to v5
console.log('\n=== Example 2: OpenAI Stream Conversion ===');

const openaiChunks = [
  {
    choices: [{
      delta: { content: 'The weather' },
      finish_reason: null
    }]
  },
  {
    choices: [{
      delta: { content: ' in San Francisco' },
      finish_reason: null
    }]
  },
  {
    choices: [{
      delta: { 
        tool_calls: [{
          id: 'call_abc',
          function: {
            name: 'getWeather',
            arguments: '{"city":'
          }
        }]
      },
      finish_reason: null
    }]
  },
  {
    choices: [{
      delta: { 
        tool_calls: [{
          id: 'call_abc',
          function: {
            arguments: '"San Francisco"}'
          }
        }]
      },
      finish_reason: null
    }]
  },
  {
    choices: [{
      delta: {},
      finish_reason: 'tool_calls'
    }]
  }
];

openaiChunks.forEach((chunk, index) => {
  const v5Parts = converter.convertOpenAIStreamChunk(chunk);
  console.log(`OpenAI chunk ${index}:`, JSON.stringify(chunk, null, 2));
  console.log(`Converted to v5:`, v5Parts);
  console.log('---');
});

// Example 3: Creating v5 Streaming Response from Scratch
console.log('\n=== Example 3: Creating v5 Stream from Scratch ===');

const textStream = converter.createTextStream(
  'This is a complete response that will be streamed in chunks.',
  20 // chunk size
);

console.log('Text stream parts:', textStream);

// Convert to SSE format
const sseResponse = converter.createStreamingResponse(textStream);
console.log('SSE Response:\n', sseResponse);

// Example 4: Complex Streaming with Reasoning and Tools
console.log('\n=== Example 4: Complex Stream with Reasoning ===');

const complexStream = new V5StreamBuilder()
  .addReasoning('Let me think about this weather question step by step...', 25)
  .addText('Based on my analysis, ', 10)
  .addToolCall('getWeather', 'call_weather_1', { city: 'San Francisco', unit: 'celsius' })
  .addToolResult('call_weather_1', 'getWeather', { 
    temperature: 22, 
    condition: 'sunny', 
    humidity: 65 
  })
  .addText('the weather in San Francisco is sunny with a temperature of 22°C.', 15)
  .addSource('url', {
    url: 'https://weather.com/weather/today/l/San+Francisco+CA',
    title: 'San Francisco Weather - Weather.com',
    description: 'Current weather conditions for San Francisco'
  });

const complexSSE = complexStream.build();
console.log('Complex SSE Response:\n', complexSSE);

// Example 5: Real-time API Route Implementation
console.log('\n=== Example 5: API Route Pattern ===');

// Simulating an API route that converts incoming streams to v5
async function processStreamingRequest(incomingStream: AsyncIterable<any>): Promise<string> {
  const streamBuilder = new V5StreamBuilder();
  const converter = new VercelAISDKv5StreamConverter();
  
  // Process incoming stream chunks
  for await (const chunk of incomingStream) {
    const v5Parts = converter.convertStreamChunk(chunk);
    v5Parts.forEach(part => {
      // Add each converted part to the response
      if (part.type === 'text-start' || part.type === 'text-delta' || part.type === 'text-end') {
        // Handle text streaming
      } else if (part.type === 'tool-call') {
        streamBuilder.addToolResult(part.toolCallId, part.toolName, part.input);
      } else if (part.type === 'source') {
        streamBuilder.addSource(part.sourceType, {
          id: part.id,
          url: part.url,
          title: part.title,
          description: part.description
        });
      }
    });
  }
  
  return streamBuilder.build();
}

// Example usage with mock incoming stream
async function* mockIncomingStream() {
  yield { type: 'text-delta', textDelta: 'Processing your request...' };
  yield { 
    type: 'tool-call', 
    toolCallId: 'call_1', 
    toolName: 'searchDatabase', 
    args: { query: 'AI SDK v5' } 
  };
  yield { 
    type: 'source', 
    source: { 
      sourceType: 'url', 
      id: 'src_1', 
      url: 'https://sdk.vercel.ai', 
      title: 'AI SDK Documentation' 
    } 
  };
}

processStreamingRequest(mockIncomingStream()).then(response => {
  console.log('Processed streaming response:\n', response);
});

// Example 6: Error Handling in Streams
console.log('\n=== Example 6: Error Handling ===');

const errorStream = new V5StreamBuilder()
  .addText('Starting process...', 10)
  .addToolCall('riskyOperation', 'call_risky_1', { action: 'process_data' })
  .addToolResult('call_risky_1', 'riskyOperation', { error: 'Connection timeout' }, true)
  .addData({ type: 'error', message: 'Operation failed, retrying...', retryable: true });

const errorSSE = errorStream.build();
console.log('Error handling SSE:\n', errorSSE);

// Example 7: File Generation Streaming
console.log('\n=== Example 7: File Generation ===');

const fileStream = new V5StreamBuilder()
  .addText('Generating your document...', 15)
  .addFile(
    'application/pdf',
    'JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwo+PgplbmRvYmoK...', // base64 PDF data
    'https://example.com/generated-document.pdf'
  )
  .addText('Document generated successfully!', 10);

const fileSSE = fileStream.build();
console.log('File generation SSE:\n', fileSSE);

// Example 8: Multi-modal Streaming (Text + Images + Sources)
console.log('\n=== Example 8: Multi-modal Streaming ===');

const multiModalStream = new V5StreamBuilder()
  .addReasoning('I need to analyze this image and provide context from reliable sources.', 30)
  .addText('Looking at this image, I can see ', 15)
  .addFile(
    'image/jpeg',
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ...', // base64 image
    'https://example.com/analyzed-image.jpg'
  )
  .addSource('url', {
    url: 'https://en.wikipedia.org/wiki/Computer_vision',
    title: 'Computer Vision - Wikipedia',
    description: 'Overview of computer vision techniques and applications'
  })
  .addText('Based on the computer vision analysis and the provided context, this appears to be...', 20);

const multiModalSSE = multiModalStream.build();
console.log('Multi-modal SSE:\n', multiModalSSE);

// Example 9: Performance Monitoring Stream
console.log('\n=== Example 9: Performance Monitoring ===');

const performanceStream = new V5StreamBuilder()
  .addData({ type: 'metrics', stage: 'start', timestamp: Date.now() })
  .addText('Processing request...', 10)
  .addData({ type: 'metrics', stage: 'processing', progress: 25, timestamp: Date.now() })
  .addToolCall('analyzeData', 'call_analyze_1', { dataset: 'user_behavior' })
  .addData({ type: 'metrics', stage: 'processing', progress: 75, timestamp: Date.now() })
  .addToolResult('call_analyze_1', 'analyzeData', { 
    insights: ['High engagement on mobile', 'Peak usage at 2pm'], 
    confidence: 0.94 
  })
  .addData({ type: 'metrics', stage: 'complete', timestamp: Date.now(), duration: 1250 });

const performanceSSE = performanceStream.build();
console.log('Performance monitoring SSE:\n', performanceSSE);

// Example 10: Quick Utility Functions
console.log('\n=== Example 10: Quick Utilities ===');

// Quick text streaming
const quickText = createStreamingTextResponse('Hello from v5 streaming!', 5);
console.log('Quick text stream:\n', quickText);

// Quick conversion
const legacyChunk: LegacyStreamPart = { 
  type: 'text-delta', 
  textDelta: 'Quick conversion test' 
};
const convertedParts = convertToV5StreamPart(legacyChunk);
console.log('Quick conversion:', convertedParts);

// Quick SSE formatting
const testPart: V5StreamPart = { 
  type: 'text-delta', 
  id: 'text-123', 
  delta: 'SSE test' 
};
const sseFormatted = convertToSSE(testPart);
console.log('Quick SSE format:\n', sseFormatted);

console.log('\n=== All Streaming Examples Complete ===');

// Export for use in other files
export {
  legacyV4Chunks,
  openaiChunks,
  processStreamingRequest,
  mockIncomingStream
};