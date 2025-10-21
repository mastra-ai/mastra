import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { weatherInfo } from '../tools';
import { simulateReadableStream } from 'ai';
import * as aiTest from 'ai/test';
import { fixtures } from '../../../fixtures';
import { Fixtures } from '../../../types';

const memory = new Memory({
  // ...
  storage: new LibSQLStore({
    url: 'file:../mastra.db',
  }),
  // ...
});

let count = 0;

export const weatherAgent = new Agent({
  name: 'Weather Agent',
  instructions: `
      You are a helpful weather assistant that provides accurate weather information.

      Your primary function is to help users get weather details for specific locations. When responding:
      - Always ask for a location if none is provided
      - If the location name isn’t in English, please translate it
      - If giving a location with multiple parts (e.g. "New York, NY"), use the most relevant part (e.g. "New York")
      - Include relevant details like humidity, wind conditions, and precipitation
      - Keep responses concise but informative
`,
  model: ({ runtimeContext }) => {
    const fixture = runtimeContext.get('fixture') as Fixtures;
    const fixtureData = fixtures[fixture];

    return new aiTest.MockLanguageModelV2({
      doStream: async () => {
        count++;

        const chunk = fixtureData[count - 1] as Array<any>;

        if (count === fixtureData.length) {
          count = 0;
        }

        return {
          stream: simulateReadableStream({
            chunks: chunk,
            delay: 100,
          }),
        };
      },
    });
  },
  tools: { weatherInfo },
  memory,
});
