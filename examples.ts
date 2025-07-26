/**
 * Examples of using the Vercel AI SDK v5 Data Format Converter
 * 
 * This file demonstrates various real-world scenarios for converting
 * different data formats to Vercel AI SDK v5 format.
 */

import {
  VercelAISDKv5Converter,
  convertToUIMessage,
  convertToModelMessage,
  convertToUIMessages,
  convertToModelMessages,
  type UIMessage,
  type ModelMessage,
} from './ai-sdk-v5-converter';

// Example 1: Converting Legacy v4 Messages
console.log('=== Example 1: Legacy v4 Message Conversion ===');

const legacyV4Message = {
  id: 'msg-123',
  role: 'user',
  content: 'Can you analyze this image and tell me what you see?',
  experimental_attachments: [
    {
      name: 'vacation-photo.jpg',
      contentType: 'image/jpeg',
      url: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...'
    },
    {
      name: 'document.pdf',
      contentType: 'application/pdf',
      url: 'https://example.com/documents/report.pdf'
    }
  ]
};

// Convert to UIMessage for frontend display
const uiMessage = convertToUIMessage(legacyV4Message);
console.log('UIMessage:', JSON.stringify(uiMessage, null, 2));

// Convert to ModelMessage for AI processing
const modelMessage = convertToModelMessage(legacyV4Message);
console.log('ModelMessage:', JSON.stringify(modelMessage, null, 2));

// Example 2: Converting OpenAI Chat Completion Format
console.log('\n=== Example 2: OpenAI Format Conversion ===');

const openaiMessages = [
  {
    role: 'user',
    content: [
      { type: 'text', text: 'What do you see in this image?' },
      { 
        type: 'image_url', 
        image_url: { url: 'https://example.com/image.jpg' } 
      }
    ]
  },
  {
    role: 'assistant',
    content: 'I can see a beautiful landscape with mountains and trees.',
    tool_calls: [
      {
        id: 'call_123',
        type: 'function',
        function: {
          name: 'analyzeImage',
          arguments: JSON.stringify({ 
            imageUrl: 'https://example.com/image.jpg',
            analysisType: 'detailed' 
          })
        }
      }
    ]
  }
];

const convertedUIMessages = convertToUIMessages(openaiMessages);
const convertedModelMessages = convertToModelMessages(openaiMessages);

console.log('Converted UI Messages:', JSON.stringify(convertedUIMessages, null, 2));
console.log('Converted Model Messages:', JSON.stringify(convertedModelMessages, null, 2));

// Example 3: Advanced Tool Usage with v4 to v5 Conversion
console.log('\n=== Example 3: Tool Invocation Conversion ===');

const messageWithTools = {
  id: 'msg-tools-456',
  role: 'assistant',
  content: 'I\'ll help you get the weather information.',
  toolInvocations: [
    {
      toolCallId: 'call_weather_1',
      toolName: 'getWeather',
      args: { city: 'San Francisco', unit: 'celsius' },
      state: 'call'
    },
    {
      toolCallId: 'call_weather_2',
      toolName: 'getWeather',
      args: { city: 'New York', unit: 'celsius' },
      state: 'result',
      result: { temperature: 22, condition: 'sunny', humidity: 65 }
    }
  ]
};

const toolUIMessage = convertToUIMessage(messageWithTools);
console.log('Tool UI Message:', JSON.stringify(toolUIMessage, null, 2));

// Example 4: Using the Converter Class for Advanced Scenarios
console.log('\n=== Example 4: Advanced Converter Usage ===');

const converter = new VercelAISDKv5Converter({
  generateId: () => `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  includeTimestamp: true,
  preserveOriginalId: false,
  defaultMediaType: 'application/json'
});

// Create custom data parts
const customDataPart = converter.createDataPart('status', {
  loading: true,
  progress: 45,
  stage: 'processing'
});

// Create source parts for citations
const sourcePart = converter.createSourcePart('url', {
  url: 'https://en.wikipedia.org/wiki/Artificial_intelligence',
  title: 'Artificial Intelligence - Wikipedia',
  description: 'Comprehensive article about AI'
});

// Create reasoning part
const reasoningPart = converter.createReasoningPart(
  'Let me think about this step by step. First, I need to understand the user\'s question...'
);

console.log('Custom Data Part:', JSON.stringify(customDataPart, null, 2));
console.log('Source Part:', JSON.stringify(sourcePart, null, 2));
console.log('Reasoning Part:', JSON.stringify(reasoningPart, null, 2));

// Example 5: Message with Reasoning (for reasoning models like Claude Sonnet)
console.log('\n=== Example 5: Reasoning Message Conversion ===');

const reasoningMessage = {
  id: 'msg-reasoning-789',
  role: 'assistant',
  reasoning: 'I need to carefully analyze this mathematical problem. Let me break it down: 1) First, I\'ll identify the variables, 2) Then apply the appropriate formula, 3) Finally, verify the result.',
  content: 'The answer to your math problem is 42. Here\'s how I solved it step by step...'
};

const reasoningUIMessage = convertToUIMessage(reasoningMessage);
console.log('Reasoning UI Message:', JSON.stringify(reasoningUIMessage, null, 2));

// Example 6: Metadata Usage
console.log('\n=== Example 6: Message with Metadata ===');

interface CustomMetadata {
  model: string;
  temperature: number;
  duration: number;
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
}

const messageWithMetadata = {
  role: 'assistant',
  content: 'This response was generated with specific model parameters.'
};

const metadata: CustomMetadata = {
  model: 'gpt-4',
  temperature: 0.7,
  duration: 1250,
  tokenUsage: {
    prompt: 15,
    completion: 42,
    total: 57
  }
};

const uiMessageWithMetadata = convertToUIMessage(messageWithMetadata, {}, metadata);
console.log('UI Message with Metadata:', JSON.stringify(uiMessageWithMetadata, null, 2));

// Example 7: Conversation Thread Conversion
console.log('\n=== Example 7: Full Conversation Thread ===');

const conversationThread = [
  {
    id: 'msg-1',
    role: 'user',
    content: 'Hello! Can you help me plan a trip to Japan?'
  },
  {
    id: 'msg-2',
    role: 'assistant',
    content: 'I\'d be happy to help you plan a trip to Japan! To give you the best recommendations, could you tell me a few things?',
    toolInvocations: [
      {
        toolCallId: 'call_travel_1',
        toolName: 'getTravelInfo',
        args: { destination: 'Japan', infoType: 'planning_questions' },
        state: 'result',
        result: {
          questions: [
            'What time of year are you planning to visit?',
            'What are your main interests (culture, food, nature, etc.)?',
            'What\'s your approximate budget?'
          ]
        }
      }
    ]
  },
  {
    id: 'msg-3',
    role: 'user',
    content: 'I want to visit in spring, love cherry blossoms and traditional culture. Budget is around $3000.',
    experimental_attachments: [
      {
        name: 'inspiration.jpg',
        contentType: 'image/jpeg',
        url: 'data:image/jpeg;base64,inspiration_image_data...'
      }
    ]
  }
];

const convertedConversation = convertToUIMessages(conversationThread);
console.log('Converted Conversation:', JSON.stringify(convertedConversation, null, 2));

// Example 8: Error Handling and Edge Cases
console.log('\n=== Example 8: Error Handling ===');

try {
  // Handle malformed input
  const malformedMessage = {
    // Missing required fields
    content: null,
    role: 'invalid_role'
  };

  const safeCOnvertedMessage = convertToUIMessage(malformedMessage);
  console.log('Safely converted malformed message:', JSON.stringify(safeCOnvertedMessage, null, 2));

  // Handle empty or undefined content
  const emptyMessage = {
    role: 'user',
    content: ''
  };

  const convertedEmptyMessage = convertToUIMessage(emptyMessage);
  console.log('Converted empty message:', JSON.stringify(convertedEmptyMessage, null, 2));

} catch (error) {
  console.error('Error during conversion:', error);
}

// Example 9: Real-world API Integration Pattern
console.log('\n=== Example 9: API Integration Pattern ===');

// Simulating an API response that needs conversion
async function processIncomingMessage(rawMessage: any): Promise<{
  uiMessage: UIMessage;
  modelMessage: ModelMessage;
}> {
  // Convert for frontend display
  const uiMessage = convertToUIMessage(rawMessage, {
    includeTimestamp: true,
    preserveOriginalId: true
  });

  // Convert for AI model processing
  const modelMessage = convertToModelMessage(rawMessage);

  return { uiMessage, modelMessage };
}

// Example usage in an API route
const incomingApiMessage = {
  id: 'api-msg-123',
  role: 'user',
  content: 'What\'s the weather like today?',
  timestamp: new Date().toISOString(),
  clientInfo: {
    userAgent: 'Mozilla/5.0...',
    ipAddress: '192.168.1.1'
  }
};

processIncomingMessage(incomingApiMessage).then(({ uiMessage, modelMessage }) => {
  console.log('Processed for UI:', JSON.stringify(uiMessage, null, 2));
  console.log('Processed for Model:', JSON.stringify(modelMessage, null, 2));
});

// Example 10: Streaming Data Parts
console.log('\n=== Example 10: Streaming Data Parts ===');

const converter2 = new VercelAISDKv5Converter();

// Create progressive data parts for streaming UI updates
const progressParts = [
  converter2.createDataPart('progress', { step: 1, message: 'Initializing...' }),
  converter2.createDataPart('progress', { step: 2, message: 'Processing image...' }),
  converter2.createDataPart('progress', { step: 3, message: 'Analyzing content...' }),
  converter2.createDataPart('progress', { step: 4, message: 'Generating response...' }),
];

progressParts.forEach((part, index) => {
  console.log(`Progress Part ${index + 1}:`, JSON.stringify(part, null, 2));
});

console.log('\n=== Conversion Examples Complete ===');

export {
  legacyV4Message,
  openaiMessages,
  messageWithTools,
  reasoningMessage,
  conversationThread,
  processIncomingMessage
};