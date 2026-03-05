import { openai } from '@ai-sdk/openai-v5';
import { config } from 'dotenv';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type { ChunkType } from '../../stream';
import { createTool } from '../../tools/tool';
import { Agent } from '../agent';

config();

describe('agent.stopWhen', () => {
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

  const agent = new Agent({
    id: 'test-step-boundaries',
    name: 'Test Step Boundaries',
    instructions:
      'You are a helpful assistant. Figure out the weather and then using that weather plan some activities. Always use the weather tool first, and then the plan activities tool with the result of the weather tool',
    model: openai('gpt-4o-mini'),
    tools: {
      weatherTool,
      planActivities,
    },
  });

  it('should demonstrate that stopWhen gets the proper step results in the first step', async () => {
    let stopWhenCallCount = 0;
    const stopWhenCalls: { callNumber: number; steps: any[] }[] = [];

    const stream = await agent.stream('What should i be doing in Toronto today?', {
      stopWhen: ({ steps }) => {
        stopWhenCallCount++;
        // Store the call details
        stopWhenCalls.push({
          callNumber: stopWhenCallCount,
          steps: JSON.parse(JSON.stringify(steps)), // Deep copy to preserve state
        });

        // Check if any step has tool calls
        const hasToolCalls = steps.some(step => {
          return step.content && step.content.some(item => item.type === 'tool-call' || item.type === 'tool-result');
        });

        if (hasToolCalls) {
          console.log(`Found tool calls in steps, attempting to stop...`);
          // Try to stop immediately after finding tool calls
          return true;
        }

        return false;
      },
    });

    const chunks: ChunkType[] = [];
    let stepStartCount = 0;
    let foundToolCallChunk = false;
    let foundTextChunk = false;
    for await (const chunk of stream.fullStream) {
      chunks.push(chunk);

      if (chunk.type === 'step-start') {
        stepStartCount++;
      } else if (chunk.type === 'tool-call') {
        foundToolCallChunk = true;
      } else if (chunk.type === 'text-delta' && chunk.payload.text.trim()) {
        foundTextChunk = true;
      }
    }

    expect(foundToolCallChunk).toBe(true);

    expect(stepStartCount).toBe(1);
    expect(foundTextChunk).toBe(false);

    expect(stopWhenCallCount).toBe(1);
  }, 10000);

  it('should not call stopWhen on the final step', async () => {
    let stopWhenCallCount = 0;
    const stopWhenCalls: { callNumber: number; stepCount: number }[] = [];

    const trackStopWhenCalls = ({ steps }: { steps: any[] }) => {
      stopWhenCallCount++;
      stopWhenCalls.push({
        callNumber: stopWhenCallCount,
        stepCount: steps.length,
      });

      return false;
    };

    const stream = await agent.stream('What should i be doing in Toronto today?', {
      stopWhen: trackStopWhenCalls,
    });

    let stepStartCount = 0;
    let stepFinishCount = 0;

    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'step-start') {
        stepStartCount++;
        console.log(`Step ${stepStartCount} started`);
      } else if (chunk.type === 'step-finish') {
        stepFinishCount++;
        console.log(`Step ${stepFinishCount} finished`);
      }
    }

    await stream.consumeStream();

    // Verify that stopWhen is called n-1 times for n steps
    expect(stepStartCount).toBe(stepFinishCount);
    expect(stepStartCount).toBeGreaterThanOrEqual(2);

    expect(stopWhenCallCount).toBe(stepStartCount - 1);

    stopWhenCalls.forEach((call, index) => {
      expect(call.stepCount).toBe(index + 1);
    });
  }, 25000);

  it('should contain the correct content in the step results for both stopWhen and stream.steps', async () => {
    const stopWhenContent: any[] = [];
    const stream = await agent.stream('What should i be doing in Toronto today?', {
      stopWhen: ({ steps }) => {
        stopWhenContent.push(steps.at(-1)?.content);
        return false;
      },
    });

    await stream.consumeStream();

    const steps = await stream.steps;

    expect(stopWhenContent[0].length).toBe(2);
    expect(stopWhenContent[1].length).toBe(2);

    expect(steps[0].content.length).toBe(2);
    expect(steps[1].content.length).toBe(2);
    expect(steps[2].content.length).toBe(1);

    expect(stopWhenContent[1]).not.toEqual(stopWhenContent[0]);
  }, 20000);

  it('should contain the correct content in the step results for both stopWhen and stream.steps with text and tool calls in the same step', async () => {
    const agent = new Agent({
      id: 'test-step-boundaries',
      name: 'Test Step Boundaries',
      instructions:
        'You are a helpful assistant. Figure out the weather and then using that weather plan some activities. Always use the weather tool first, and then the plan activities tool with the result of the weather tool. Every tool call you make IMMEDIATELY explain the tool results after executing the tool, before moving on to other steps or tool calls',
      model: openai('gpt-4o-mini'),
      tools: {
        weatherTool,
        planActivities,
      },
    });

    const stopWhenContent: any[] = [];
    const stream = await agent.stream('What should i be doing in Toronto today?', {
      stopWhen: ({ steps }) => {
        stopWhenContent.push(steps.at(-1)?.content);
        return false;
      },
    });

    await stream.consumeStream();
    const steps = await stream.steps;

    expect(stopWhenContent[0].length).toBe(2);
    expect(stopWhenContent[1].length).toBe(3); // text explaining the previous tool-call-results, tool-call, tool-result

    expect(steps[0].content.length).toBe(2);
    expect(steps[1].content.length).toBe(3); // text explaining the previous tool-call-results, tool-call, tool-result
    expect(steps[2].content.length).toBe(1);

    expect(stopWhenContent[1]).not.toEqual(stopWhenContent[0]);
  }, 20000);
});
