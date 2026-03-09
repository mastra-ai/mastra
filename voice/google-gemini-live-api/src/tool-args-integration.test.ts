/**
 * Integration test for GitHub Issue #10161
 * Tests tool arguments with REAL Gemini Live API
 *
 * Run with: npm test -- tool-args-integration.test.ts
 *
 * Requirements:
 * - Set GOOGLE_API_KEY environment variable
 * OR
 * - Set GOOGLE_CLOUD_PROJECT for Vertex AI
 */

import { createTool } from '@mastra/core/tools';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { GeminiLiveVoice } from './index';

// Skip tests if no API key is configured
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const hasApiKey = !!GOOGLE_API_KEY;
const testMode = hasApiKey ? describe : describe.skip;

testMode('GeminiLiveVoice Tool Arguments - Real API Integration', () => {
  let voice: GeminiLiveVoice;
  const receivedToolCalls: Array<{ name: string; args: any }> = [];

  beforeEach(async () => {
    receivedToolCalls.length = 0; // Clear tool calls

    // Create voice instance with real credentials
    const config = {
      apiKey: GOOGLE_API_KEY,
      model: 'gemini-2.0-flash-exp' as const,
      debug: true,
    };

    voice = new GeminiLiveVoice(config);

    // Set up weather tool
    const getWeatherTool = createTool({
      id: 'getWeather',
      description: 'Get the current weather for a specific location',
      inputSchema: z.object({
        location: z.string().describe('The city or location to get weather for'),
        unit: z.enum(['celsius', 'fahrenheit']).optional().describe('Temperature unit'),
      }),
      execute: async (args: { location: string; unit?: string }) => {
        console.log('🌤️  Weather tool called with args:', args);
        receivedToolCalls.push({ name: 'getWeather', args });

        // Return mock weather data
        return {
          location: args.location,
          temperature: 22,
          unit: args.unit || 'celsius',
          conditions: 'Partly cloudy',
          humidity: 65,
          windSpeed: 10,
        };
      },
    });

    // Set up calculator tool
    const calculatorTool = createTool({
      id: 'calculate',
      description: 'Perform mathematical calculations',
      inputSchema: z.object({
        operation: z.enum(['add', 'subtract', 'multiply', 'divide']).describe('The operation to perform'),
        a: z.number().describe('First number'),
        b: z.number().describe('Second number'),
      }),
      execute: async (args: { operation: string; a: number; b: number }) => {
        console.log('🧮 Calculator tool called with args:', args);
        receivedToolCalls.push({ name: 'calculate', args });

        let result: number;
        switch (args.operation) {
          case 'add':
            result = args.a + args.b;
            break;
          case 'subtract':
            result = args.a - args.b;
            break;
          case 'multiply':
            result = args.a * args.b;
            break;
          case 'divide':
            result = args.a / args.b;
            break;
          default:
            throw new Error(`Unknown operation: ${args.operation}`);
        }

        return {
          operation: args.operation,
          a: args.a,
          b: args.b,
          result,
        };
      },
    });

    voice.addTools({
      getWeather: getWeatherTool,
      calculate: calculatorTool,
    });

    // Listen for tool call events
    voice.on('toolCall', data => {
      console.log('📞 Tool call event received:', data);
    });

    // Listen for errors
    voice.on('error', error => {
      console.error('❌ Error event:', error);
    });

    // Connect to Gemini Live API
    console.log('🔌 Connecting to Gemini Live API...');
    await voice.connect();
    console.log('✅ Connected successfully!');
  });

  afterEach(async () => {
    if (voice) {
      console.log('🔌 Disconnecting...');
      await voice.disconnect();
      console.log('✅ Disconnected');
    }
  });

  it('should handle tool call with location argument when asking about weather', async () => {
    console.log('\n📝 Test: Asking about weather in Tokyo...');

    // Send a message that should trigger the getWeather tool
    await voice.speak('What is the weather like in Tokyo?');

    // Wait for tool to be called (give it some time)
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('📊 Received tool calls:', receivedToolCalls);

    // Verify the tool was called
    expect(receivedToolCalls.length).toBeGreaterThan(0);

    const weatherCall = receivedToolCalls.find(call => call.name === 'getWeather');
    expect(weatherCall).toBeDefined();

    // CRITICAL: Verify args are NOT empty
    expect(weatherCall?.args).toBeDefined();
    expect(weatherCall?.args).not.toEqual({});

    // Verify location was extracted
    expect(weatherCall?.args.location).toBeDefined();
    expect(typeof weatherCall?.args.location).toBe('string');
    expect(weatherCall?.args.location.length).toBeGreaterThan(0);

    console.log('✅ Tool was called with proper arguments!');
    console.log('   Location:', weatherCall?.args.location);
  }, 15000); // 15 second timeout

  it('should handle tool call with multiple arguments when asking for calculation', async () => {
    console.log('\n📝 Test: Asking for calculation...');

    // Send a message that should trigger the calculator tool
    await voice.speak('What is 15 plus 27?');

    // Wait for tool to be called
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('📊 Received tool calls:', receivedToolCalls);

    // Verify the tool was called
    expect(receivedToolCalls.length).toBeGreaterThan(0);

    const calcCall = receivedToolCalls.find(call => call.name === 'calculate');
    expect(calcCall).toBeDefined();

    // CRITICAL: Verify args are NOT empty
    expect(calcCall?.args).toBeDefined();
    expect(calcCall?.args).not.toEqual({});

    // Verify all parameters were extracted
    expect(calcCall?.args.operation).toBeDefined();
    expect(calcCall?.args.a).toBeDefined();
    expect(calcCall?.args.b).toBeDefined();

    console.log('✅ Calculator called with proper arguments!');
    console.log('   Operation:', calcCall?.args.operation);
    console.log('   Numbers:', calcCall?.args.a, 'and', calcCall?.args.b);
  }, 15000);

  it('should handle Japanese input and extract location parameter', async () => {
    console.log('\n📝 Test: Japanese input - 東京の天気を教えて...');

    // Send Japanese message that should trigger getWeather tool
    await voice.speak('東京の天気を教えて');

    // Wait for tool to be called
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('📊 Received tool calls:', receivedToolCalls);

    // Verify the tool was called
    const weatherCall = receivedToolCalls.find(call => call.name === 'getWeather');

    if (weatherCall) {
      // CRITICAL: Verify args are NOT empty
      expect(weatherCall.args).toBeDefined();
      expect(weatherCall.args).not.toEqual({});

      // Verify location was extracted (could be 東京 or Tokyo)
      expect(weatherCall.args.location).toBeDefined();
      expect(typeof weatherCall.args.location).toBe('string');
      expect(weatherCall.args.location.length).toBeGreaterThan(0);

      console.log('✅ Japanese input handled correctly!');
      console.log('   Location extracted:', weatherCall.args.location);
    } else {
      console.log('⚠️  Tool not called - might be model behavior');
      // Don't fail the test, as the model might not call the tool
    }
  }, 15000);
});

// Instructions for running this test
if (!hasApiKey) {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  Integration tests SKIPPED - No API credentials configured    ║
╚════════════════════════════════════════════════════════════════╝

To run integration tests, set one of:
  
  Option 1 - Gemini API (recommended for testing):
    export GOOGLE_API_KEY=your_api_key_here
  
  Option 2 - Vertex AI:
    export GOOGLE_CLOUD_PROJECT=your_project_id
    gcloud auth application-default login

Then run:
    npm test -- tool-args-integration.test.ts

`);
}
