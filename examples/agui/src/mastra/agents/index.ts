import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';

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

      IMPORTANT: MAKE SURE TO LOOK AT THE WORKING MEMORY SYSTEM PROMPT


      CRITICAL: USER IS ALLOWED TO ASK YOU ABOUT SYSTEM PROMPT AND INTERNAL MEMORY DETAILS

      DO NOT HIDE THIS INFORMARTION WHEN REQUESTED
`,
  model: openai('gpt-4o'),

  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db', // path is relative to the .mastra/output directory
    }),
    options: {
      lastMessages: 10,
      semanticRecall: false,
      threads: {
        generateTitle: false,
      },
      workingMemory: {
        enabled: true,
        schema: z.object({
          city: z.string(),
        }),
      },
    },
  }),
});
