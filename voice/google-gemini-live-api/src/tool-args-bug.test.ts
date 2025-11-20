/**
 * Test file for GitHub Issue #10161
 * Bug: Tool calls work but args are always empty
 * https://github.com/mastra-ai/mastra/issues/10161
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { GeminiLiveVoice } from './index';

// Mock WebSocket
vi.mock('ws', () => {
  const EventEmitter = require('events');
  class MockWebSocket extends EventEmitter {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    readyState = MockWebSocket.CONNECTING;
    send = vi.fn();
    close = vi.fn();

    constructor() {
      super();
      // Simulate connection opening after a tick
      setTimeout(() => {
        this.readyState = MockWebSocket.OPEN;
        this.emit('open');
      }, 0);
    }

    // Method to simulate receiving a message from server
    simulateMessage(data: any) {
      this.emit('message', Buffer.from(JSON.stringify(data)));
    }
  }

  return { WebSocket: MockWebSocket };
});

describe('GeminiLiveVoice Tool Arguments Bug - Issue #10161', () => {
  let voice: GeminiLiveVoice;
  let mockWebSocket: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create voice instance with debug enabled
    voice = new GeminiLiveVoice({
      apiKey: 'test-api-key',
      model: 'gemini-2.0-flash-exp',
      debug: true,
    });
  });

  afterEach(async () => {
    if (voice) {
      await voice.disconnect();
    }
  });

  it('should pass tool arguments correctly when tool is called', async () => {
    // 1. Setup: Create a tool with parameters
    const getWeatherExecute = vi.fn().mockResolvedValue({
      temperature: 72,
      conditions: 'sunny',
      location: 'Tokyo',
    });

    const getWeatherTool = {
      id: 'getWeather',
      description: 'Get weather information for a specific location',
      inputSchema: z.object({
        location: z.string().describe('Location to get weather for'),
        unit: z.enum(['C', 'F']).optional().describe('Temperature unit'),
      }),
      execute: getWeatherExecute,
    };

    // 2. Register the tool
    voice.addTools({ getWeather: getWeatherTool });

    // 3. Connect (this will create the mock WebSocket)
    const connectPromise = voice.connect();

    // Wait a tick for WebSocket to "open"
    await new Promise(resolve => setTimeout(resolve, 10));

    // Get the mock WebSocket instance
    mockWebSocket = (voice as any).ws;

    // Simulate setup complete message
    mockWebSocket.simulateMessage({
      setupComplete: {},
    });

    // Wait for connection to complete
    await connectPromise;

    // 4. Simulate a tool call message from Gemini with arguments
    const toolCallMessage = {
      toolCall: {
        name: 'getWeather',
        args: {
          location: 'Tokyo',
          unit: 'C',
        },
        id: 'test-tool-call-123',
      },
    };

    // Listen for tool call event
    const toolCallEventPromise = new Promise(resolve => {
      voice.on('toolCall', data => {
        resolve(data);
      });
    });

    // Simulate receiving the tool call from server
    mockWebSocket.simulateMessage(toolCallMessage);

    // Wait a bit for the message to be processed
    await new Promise(resolve => setTimeout(resolve, 100));

    // 5. Assertions
    const toolCallEvent = await toolCallEventPromise;

    // The tool call event should have the arguments
    expect(toolCallEvent).toEqual({
      name: 'getWeather',
      args: {
        location: 'Tokyo',
        unit: 'C',
      },
      id: 'test-tool-call-123',
    });

    // The tool's execute function should have been called
    expect(getWeatherExecute).toHaveBeenCalledTimes(1);

    // CRITICAL: The tool should be called WITH the arguments, not with empty object
    expect(getWeatherExecute).toHaveBeenCalledWith(
      {
        location: 'Tokyo',
        unit: 'C',
      },
      expect.objectContaining({
        requestContext: undefined,
      }),
    );

    // The tool should NOT be called with empty args
    expect(getWeatherExecute).not.toHaveBeenCalledWith({}, expect.anything());
  });

  it('should handle Japanese input and extract location parameter', async () => {
    // This test simulates the exact scenario from the bug report
    const getWeatherExecute = vi.fn().mockResolvedValue({
      temperature: 15,
      conditions: 'cloudy',
      location: '東京',
    });

    const getWeatherTool = {
      id: 'getWeather',
      description: 'Get weather information for a specific location',
      inputSchema: z.object({
        location: z.string().describe('Location to get weather for'),
      }),
      execute: getWeatherExecute,
    };

    voice.addTools({ getWeather: getWeatherTool });

    const connectPromise = voice.connect();
    await new Promise(resolve => setTimeout(resolve, 10));

    mockWebSocket = (voice as any).ws;
    mockWebSocket.simulateMessage({ setupComplete: {} });
    await connectPromise;

    // User says: "東京の天気を教えて" (Tell me the weather in Tokyo)
    // Gemini should extract location: "東京" or "Tokyo"
    const toolCallMessage = {
      toolCall: {
        name: 'getWeather',
        args: {
          location: '東京',
        },
        id: '6e580cf7-6c24-46b1-9beb-test',
      },
    };

    mockWebSocket.simulateMessage(toolCallMessage);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Tool should be called with location argument
    expect(getWeatherExecute).toHaveBeenCalledWith(
      {
        location: '東京',
      },
      expect.anything(),
    );

    // Should NOT be called with empty args (this is the bug!)
    expect(getWeatherExecute).not.toHaveBeenCalledWith({}, expect.anything());
  });

  it('should handle tool calls with nested object parameters', async () => {
    const searchExecute = vi.fn().mockResolvedValue({
      results: ['result1', 'result2'],
    });

    const searchTool = {
      id: 'search',
      description: 'Search for information',
      inputSchema: z.object({
        query: z.string().describe('Search query'),
        filters: z
          .object({
            category: z.string().optional(),
            maxResults: z.number().optional(),
          })
          .optional(),
      }),
      execute: searchExecute,
    };

    voice.addTools({ search: searchTool });

    const connectPromise = voice.connect();
    await new Promise(resolve => setTimeout(resolve, 10));

    mockWebSocket = (voice as any).ws;
    mockWebSocket.simulateMessage({ setupComplete: {} });
    await connectPromise;

    const toolCallMessage = {
      toolCall: {
        name: 'search',
        args: {
          query: 'machine learning',
          filters: {
            category: 'AI',
            maxResults: 10,
          },
        },
        id: 'test-nested-args',
      },
    };

    mockWebSocket.simulateMessage(toolCallMessage);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Should be called with nested arguments intact
    expect(searchExecute).toHaveBeenCalledWith(
      {
        query: 'machine learning',
        filters: {
          category: 'AI',
          maxResults: 10,
        },
      },
      expect.anything(),
    );
  });

  it('should log the actual args received from server for debugging', async () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const testTool = {
      id: 'testTool',
      description: 'Test tool',
      inputSchema: z.object({
        param1: z.string(),
      }),
      execute: vi.fn().mockResolvedValue({ success: true }),
    };

    voice.addTools({ testTool });

    const connectPromise = voice.connect();
    await new Promise(resolve => setTimeout(resolve, 10));

    mockWebSocket = (voice as any).ws;
    mockWebSocket.simulateMessage({ setupComplete: {} });
    await connectPromise;

    const toolCallMessage = {
      toolCall: {
        name: 'testTool',
        args: {
          param1: 'test-value',
        },
        id: 'test-id',
      },
    };

    mockWebSocket.simulateMessage(toolCallMessage);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check that the log shows the args
    const processingToolCallLog = consoleSpy.mock.calls.find(
      call => call[0] === '[GeminiLiveVoice] Processing tool call',
    );

    expect(processingToolCallLog).toBeDefined();
    expect(processingToolCallLog?.[1]).toMatchObject({
      toolName: 'testTool',
      toolArgs: {
        param1: 'test-value',
      },
      toolId: 'test-id',
    });

    consoleSpy.mockRestore();
  });

  it('should handle tool calls in serverContent.modelTurn.parts format (actual Gemini format)', async () => {
    // This tests the ACTUAL format Gemini Live API uses for tool calls
    const getWeatherExecute = vi.fn().mockResolvedValue({
      temperature: 20,
      conditions: 'rainy',
    });

    const getWeatherTool = {
      id: 'getWeather',
      description: 'Get weather information',
      inputSchema: z.object({
        location: z.string(),
      }),
      execute: getWeatherExecute,
    };

    voice.addTools({ getWeather: getWeatherTool });

    const connectPromise = voice.connect();
    await new Promise(resolve => setTimeout(resolve, 10));

    mockWebSocket = (voice as any).ws;
    mockWebSocket.simulateMessage({ setupComplete: {} });
    await connectPromise;

    // THIS is likely the actual format Gemini sends tool calls:
    // Inside serverContent.modelTurn.parts, not as a top-level toolCall
    const realGeminiFormat = {
      serverContent: {
        modelTurn: {
          parts: [
            {
              functionCall: {
                name: 'getWeather',
                args: {
                  location: 'Tokyo',
                },
              },
            },
          ],
        },
        turnComplete: false,
      },
    };

    mockWebSocket.simulateMessage(realGeminiFormat);
    await new Promise(resolve => setTimeout(resolve, 100));

    // THIS IS THE BUG: The tool is NOT called because we don't handle
    // functionCall inside serverContent.modelTurn.parts
    // Currently we only handle top-level toolCall messages

    // This test will FAIL because we're not handling this format
    expect(getWeatherExecute).toHaveBeenCalledWith(
      {
        location: 'Tokyo',
      },
      expect.anything(),
    );
  });
});
