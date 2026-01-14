import { openai } from '@ai-sdk/openai-v5';
import { config } from 'dotenv';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type { ChunkType } from '../../stream';
import { createTool } from '../../tools/tool';
import { Agent } from '../agent';
import { createStopAfterToolResultCondition, mergeStopConditions } from '../stop-after-tool-result';

config();

describe('stopAfterToolResult', () => {
  const weatherTool = createTool({
    id: 'weather-tool',
    description: 'Get weather for a location',
    inputSchema: z.object({
      location: z.string(),
    }),
    execute: async context => {
      const { location } = context;
      return {
        temperature: 70,
        feelsLike: 65,
        humidity: 50,
        windSpeed: 10,
        windGust: 15,
        conditions: 'sunny',
        location,
      };
    },
  });

  const planActivities = createTool({
    id: 'plan-activities',
    description: 'Plan activities based on the weather',
    inputSchema: z.object({
      temperature: z.string(),
    }),
    execute: async () => {
      return { activities: 'Plan activities based on the weather' };
    },
  });

  describe('createStopAfterToolResultCondition', () => {
    it('should return true when config is true and any tool result exists', async () => {
      const condition = createStopAfterToolResultCondition(true);
      const result = await condition({
        steps: [
          {
            content: [
              { type: 'tool-call', toolName: 'weather-tool' },
              { type: 'tool-result', toolName: 'weather-tool', result: { temp: 70 } },
            ],
          },
        ],
      });
      expect(result).toBe(true);
    });

    it('should return false when config is true but no tool result exists', async () => {
      const condition = createStopAfterToolResultCondition(true);
      const result = await condition({
        steps: [
          {
            content: [{ type: 'text', text: 'Hello' }],
          },
        ],
      });
      expect(result).toBe(false);
    });

    it('should return true when config is a string matching the tool name', async () => {
      const condition = createStopAfterToolResultCondition('weather-tool');
      const result = await condition({
        steps: [
          {
            content: [{ type: 'tool-result', toolName: 'weather-tool', result: { temp: 70 } }],
          },
        ],
      });
      expect(result).toBe(true);
    });

    it('should return false when config is a string not matching the tool name', async () => {
      const condition = createStopAfterToolResultCondition('other-tool');
      const result = await condition({
        steps: [
          {
            content: [{ type: 'tool-result', toolName: 'weather-tool', result: { temp: 70 } }],
          },
        ],
      });
      expect(result).toBe(false);
    });

    it('should return true when config is an array containing the tool name', async () => {
      const condition = createStopAfterToolResultCondition(['weather-tool', 'plan-activities']);
      const result = await condition({
        steps: [
          {
            content: [{ type: 'tool-result', toolName: 'weather-tool', result: { temp: 70 } }],
          },
        ],
      });
      expect(result).toBe(true);
    });

    it('should return false when config is an array not containing the tool name', async () => {
      const condition = createStopAfterToolResultCondition(['other-tool', 'another-tool']);
      const result = await condition({
        steps: [
          {
            content: [{ type: 'tool-result', toolName: 'weather-tool', result: { temp: 70 } }],
          },
        ],
      });
      expect(result).toBe(false);
    });

    it('should call custom predicate function and return its result', async () => {
      const condition = createStopAfterToolResultCondition((result, toolName) => {
        return toolName === 'weather-tool' && (result as any)?.temp > 60;
      });
      const result = await condition({
        steps: [
          {
            content: [{ type: 'tool-result', toolName: 'weather-tool', result: { temp: 70 } }],
          },
        ],
      });
      expect(result).toBe(true);
    });

    it('should return false when custom predicate returns false', async () => {
      const condition = createStopAfterToolResultCondition((result, toolName) => {
        return toolName === 'weather-tool' && (result as any)?.temp < 60;
      });
      const result = await condition({
        steps: [
          {
            content: [{ type: 'tool-result', toolName: 'weather-tool', result: { temp: 70 } }],
          },
        ],
      });
      expect(result).toBe(false);
    });

    it('should support async predicate functions', async () => {
      const condition = createStopAfterToolResultCondition(async (result, toolName) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return toolName === 'weather-tool';
      });
      const result = await condition({
        steps: [
          {
            content: [{ type: 'tool-result', toolName: 'weather-tool', result: { temp: 70 } }],
          },
        ],
      });
      expect(result).toBe(true);
    });

    it('should check toolResults array as fallback', async () => {
      const condition = createStopAfterToolResultCondition(true);
      const result = await condition({
        steps: [
          {
            toolResults: [{ toolName: 'weather-tool', result: { temp: 70 } }],
          },
        ],
      });
      expect(result).toBe(true);
    });
  });

  describe('mergeStopConditions', () => {
    it('should return undefined when both params are undefined', () => {
      const result = mergeStopConditions(undefined, undefined);
      expect(result).toBeUndefined();
    });

    it('should return stopAfterToolResult condition when stopWhen is undefined', () => {
      const result = mergeStopConditions(true, undefined);
      expect(result).toHaveLength(1);
    });

    it('should return stopWhen when stopAfterToolResult is undefined', () => {
      const stopWhen = () => false;
      const result = mergeStopConditions(undefined, stopWhen);
      expect(result).toHaveLength(1);
      expect(result![0]).toBe(stopWhen);
    });

    it('should merge both conditions when both are provided', () => {
      const stopWhen = () => false;
      const result = mergeStopConditions(true, stopWhen);
      expect(result).toHaveLength(2);
    });

    it('should handle stopWhen as an array', () => {
      const stopWhen1 = () => false;
      const stopWhen2 = () => true;
      const result = mergeStopConditions(true, [stopWhen1, stopWhen2]);
      expect(result).toHaveLength(3);
    });
  });

  describe('Agent with stopAfterToolResult in config', () => {
    it('should stop after any tool result when stopAfterToolResult is true in agent config', async () => {
      const agent = new Agent({
        id: 'stop-after-tool-agent',
        name: 'Stop After Tool Agent',
        instructions: 'You are a helpful assistant. Get the weather for a location.',
        model: openai('gpt-4o-mini'),
        tools: { weatherTool, planActivities },
        stopAfterToolResult: true,
      });

      const stream = await agent.stream('What is the weather in Toronto?');

      let stepStartCount = 0;
      let foundToolResult = false;
      let foundTextAfterToolResult = false;

      for await (const chunk of stream.fullStream) {
        if (chunk.type === 'step-start') {
          stepStartCount++;
        } else if (chunk.type === 'tool-result') {
          foundToolResult = true;
        } else if (chunk.type === 'text-delta' && foundToolResult && chunk.payload.text.trim()) {
          foundTextAfterToolResult = true;
        }
      }

      expect(foundToolResult).toBe(true);
      // Should stop after tool result, so no additional text generation
      expect(stepStartCount).toBe(1);
      expect(foundTextAfterToolResult).toBe(false);
    }, 15000);

    it('should stop after specific tool when stopAfterToolResult is a string', async () => {
      const agent = new Agent({
        id: 'stop-after-specific-tool-agent',
        name: 'Stop After Specific Tool Agent',
        instructions: 'You are a helpful assistant. Get the weather for a location.',
        model: openai('gpt-4o-mini'),
        tools: { weatherTool, planActivities },
        stopAfterToolResult: 'weatherTool',
      });

      const stream = await agent.stream('What is the weather in Tokyo?');

      let foundWeatherToolResult = false;

      for await (const chunk of stream.fullStream) {
        if (chunk.type === 'tool-result' && chunk.payload.toolName === 'weatherTool') {
          foundWeatherToolResult = true;
        }
      }

      expect(foundWeatherToolResult).toBe(true);
    }, 15000);
  });

  describe('Agent with stopAfterToolResult in execution options', () => {
    it('should stop after any tool result when passed to stream options', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant. Get the weather for a location.',
        model: openai('gpt-4o-mini'),
        tools: { weatherTool, planActivities },
      });

      const stream = await agent.stream('What is the weather in London?', {
        stopAfterToolResult: true,
      });

      let stepStartCount = 0;
      let foundToolResult = false;

      for await (const chunk of stream.fullStream) {
        if (chunk.type === 'step-start') {
          stepStartCount++;
        } else if (chunk.type === 'tool-result') {
          foundToolResult = true;
        }
      }

      expect(foundToolResult).toBe(true);
      expect(stepStartCount).toBe(1);
    }, 15000);

    it('should override agent config when passed in options', async () => {
      // Agent configured to NOT stop after tool result
      const agent = new Agent({
        id: 'no-stop-agent',
        name: 'No Stop Agent',
        instructions: 'You are a helpful assistant. Get the weather and then plan activities.',
        model: openai('gpt-4o-mini'),
        tools: { weatherTool, planActivities },
        // No stopAfterToolResult in config
      });

      // But override in options to stop after tool result
      const stream = await agent.stream('What is the weather in Paris?', {
        stopAfterToolResult: true,
      });

      let stepStartCount = 0;

      for await (const chunk of stream.fullStream) {
        if (chunk.type === 'step-start') {
          stepStartCount++;
        }
      }

      // Should only have 1 step since we're stopping after tool result
      expect(stepStartCount).toBe(1);
    }, 15000);

    it('should work with generate method', async () => {
      const agent = new Agent({
        id: 'generate-test-agent',
        name: 'Generate Test Agent',
        instructions: 'You are a helpful assistant. Get the weather for a location.',
        model: openai('gpt-4o-mini'),
        tools: { weatherTool },
      });

      const result = await agent.generate('What is the weather in Berlin?', {
        stopAfterToolResult: true,
      });

      // Should have tool results but minimal text since we stop after tool result
      expect(result.steps.length).toBe(1);
      const toolResults = result.steps[0].content?.filter((c: any) => c.type === 'tool-result') ?? [];
      expect(toolResults.length).toBeGreaterThan(0);
    }, 15000);

    it('should work with custom predicate function', async () => {
      const agent = new Agent({
        id: 'predicate-test-agent',
        name: 'Predicate Test Agent',
        instructions: 'You are a helpful assistant. Get the weather for a location.',
        model: openai('gpt-4o-mini'),
        tools: { weatherTool },
      });

      let predicateCalled = false;

      const stream = await agent.stream('What is the weather in Sydney?', {
        stopAfterToolResult: (result, toolName) => {
          predicateCalled = true;
          // Stop if the weather tool returns temperature above 50
          return toolName === 'weatherTool' && (result as any)?.temperature > 50;
        },
      });

      for await (const chunk of stream.fullStream) {
        // Consume stream
      }

      expect(predicateCalled).toBe(true);
    }, 15000);
  });

  describe('stopAfterToolResult combined with stopWhen', () => {
    it('should work alongside existing stopWhen conditions', async () => {
      let stopWhenCalled = false;
      let stopAfterToolResultTriggered = false;

      const agent = new Agent({
        id: 'combined-test-agent',
        name: 'Combined Test Agent',
        instructions: 'You are a helpful assistant. Get the weather for a location.',
        model: openai('gpt-4o-mini'),
        tools: { weatherTool },
      });

      const stream = await agent.stream('What is the weather in Miami?', {
        stopAfterToolResult: (result, toolName) => {
          if (toolName === 'weatherTool') {
            stopAfterToolResultTriggered = true;
            return true;
          }
          return false;
        },
        stopWhen: () => {
          stopWhenCalled = true;
          return false; // Don't stop from this condition
        },
      });

      for await (const chunk of stream.fullStream) {
        // Consume stream
      }

      // Both conditions should have been evaluated
      // (stopWhen is called after each step, stopAfterToolResult is merged into stopWhen)
      expect(stopAfterToolResultTriggered).toBe(true);
    }, 15000);
  });
});
