import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

import { weatherInfo } from '../tools';
import * as aiTest from 'ai/test';
import { fixtures } from '../../../fixtures';
import { Fixtures } from '../../../types';
import { lessComplexWorkflow } from '../workflows/complex-workflow';
import { simpleMcpTool } from '../tools';
import { storage } from '../storage';

const memory = new Memory({
  // ...
  storage,

  options: {
    threads: {
      generateTitle: true,
    },
  },
});

let count = 0;

// Helper function to create a delayed readable stream
function createDelayedStream(chunks: Array<any>, delayMs: number = 10) {
  return new ReadableStream({
    async start(controller) {
      for (let i = 0; i < chunks.length; i++) {
        controller.enqueue(chunks[i]);
        // Add delay only for text-delta chunks to show progressive text streaming
        // Skip delay for other chunk types to speed up tool/workflow execution
        if (delayMs > 0 && chunks[i]?.type === 'text-delta' && i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
      controller.close();
    },
  });
}

export const subAgent = new Agent({
  id: 'sub-agent',
  name: 'Sub Agent',
  instructions: `You are a helpful sub agent that provides accurate weather information.`,
  model: 'google/gemini-2.5-pro',
});

export const weatherAgent = new Agent({
  id: 'weather-agent',
  name: 'Weather Agent',
  instructions: `
      You are a helpful weather assistant that provides accurate weather information.

      Your primary function is to help users get weather details for specific locations. When responding:
      - Always ask for a location if none is provided
      - If the location name isn't in English, please translate it
      - If giving a location with multiple parts (e.g. "New York, NY"), use the most relevant part (e.g. "New York")
      - Include relevant details like humidity, wind conditions, and precipitation
      - Keep responses concise but informative
`,
  model: ({ requestContext }) => {
    const fixture = requestContext.get('fixture') as Fixtures;

    console.log({ fixture });
    const fixtureData = fixtures[fixture];

    return new aiTest.MockLanguageModelV2({
      doGenerate: async () => {
        const chunk = fixtureData[count] as Array<any>;

        count++;
        if (count >= fixtureData.length) {
          count = 0;
        }

        // Extract text from fixture chunks
        const textChunks = chunk.filter((item: any) => item.type === 'text-delta').map((item: any) => item.delta);
        const text = textChunks.join('');

        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [
            {
              type: 'text',
              text,
            },
          ],
          warnings: [],
        };
      },
      doStream: async () => {
        const chunk = fixtureData[count] as Array<any>;

        count++;
        if (count >= fixtureData.length) {
          count = 0;
        }

        return {
          stream: createDelayedStream(chunk, 20),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    });
  },
  tools: { weatherInfo, simpleMcpTool },
  agents: { subAgent },
  workflows: { lessComplexWorkflow },
  memory,
});
