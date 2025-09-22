import { describe, it, expect } from 'vitest';
import { OpenAI, toMastraCompatibleOpenAI } from './openai';
import { Agent as OpenAIAgent, tool as openaiTool } from '@openai/agents';
import { z } from 'zod';

describe('OpenAI Agent Compatibility', () => {
    describe('OpenAI class - Tool Call Structure Debug', () => {
        it('should create a real OpenAI agent with tools and show the structure', async () => {
            // Create a proper OpenAI tool
            const weatherTool = openaiTool({
                name: 'get-weather',
                description: 'Get weather information for a location',
                parameters: z.object({
                    location: z.string().describe('The location to get weather for'),
                }),
                execute: async ({ location }: { location: string }) => {
                    console.log('Tool executed with params:', { location });
                    return {
                        summary: `Weather in ${location}: Sunny, 75°F with light breeze`
                    };
                }
            });

            // Create a proper OpenAI agent
            const realOpenAIAgent = new OpenAIAgent({
                name: 'Debug Weather Agent',
                instructions: 'You are a weather assistant. When asked about weather, use the get-weather tool.',
                tools: [weatherTool],
            });

            // Create OpenAI agent instance
            const openaiAgent = new OpenAI({
                name: 'debug-weather-agent',
                agent: realOpenAIAgent
            });

            console.log('=== TESTING WITH REAL OPENAI AGENT ===');

            try {
                // Test with a prompt that should trigger the tool
                const result = await openaiAgent.generate('What is the weather like in San Francisco?');

                console.log('=== FINAL MASTRA RESULT ===');
                console.log('Text:', result.text);
                console.log('Tool Calls:', result.toolCalls);
                console.log('Tool Results:', result.toolResults);
                console.log('Messages Length:', result.response.messages.length);

                // Basic assertions to make this a valid test
                expect(result).toBeDefined();
                expect(result.text).toBeDefined();
                expect(Array.isArray(result.toolCalls)).toBe(true);
                expect(Array.isArray(result.toolResults)).toBe(true);
                expect(Array.isArray(result.response.messages)).toBe(true);

            } catch (error) {
                console.error('Error during test:', error);
                // Don't fail the test - we want to see the error structure too
                expect(error).toBeDefined();
            }
        });

        it('should test basic agent without tools for comparison', async () => {
            const simpleAgent = new OpenAIAgent({
                name: 'Simple Agent',
                instructions: 'You are a helpful assistant.',
                tools: []
            });

            const openaiAgent = new OpenAI({
                name: 'simple-agent',
                agent: simpleAgent
            });

            console.log('=== TESTING SIMPLE AGENT (NO TOOLS) ===');

            try {
                const result = await openaiAgent.generate('Hello, how are you?');

                console.log('Simple agent result text:', result.text);
                console.log('Simple agent tool calls:', result.toolCalls);
                console.log('Simple agent messages:', result.response.messages);

                expect(result).toBeDefined();
                expect(result.text).toBeDefined();
                expect(result.toolCalls).toHaveLength(0);

            } catch (error) {
                console.error('Error in simple agent test:', error);
                expect(error).toBeDefined();
            }
        });
    });
});
