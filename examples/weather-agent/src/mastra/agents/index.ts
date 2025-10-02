import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { Agent } from '@mastra/core/agent';
// import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';

// import { OpenAIVoice } from '@mastra/voice-openai';

import { weatherTool } from '../tools';

// const voice = new OpenAIVoice();

// const memory = new Memory({
//   storage: new LibSQLStore({
//     url: 'file:../mastra.db', // Or your database URL
//   }),
// });

export const weatherAgent = new Agent({
  name: 'Weather Agent',
  instructions: `You are a helpful weather assistant that provides accurate weather information.

Your primary function is to help users get weather details for specific locations. When responding:
- Always ask for a location if none is provided
- If the location name isn’t in English, please translate it
- If giving a location with multiple parts (e.g. "New York, NY"), use the most relevant part (e.g. "New York")
- Include relevant details like humidity, wind conditions, and precipitation
- Keep responses concise but informative

Use the weatherTool to fetch current weather data.`,
  model: [
    { model: anthropic('claude-3-5-sonnet-20241022') },
    { model: openai('gpt-4o') },
    { model: openai('gpt-4o-mini') },
  ],
  maxRetries: 3,
  tools: { weatherTool },
  // memory,
  // voice,
});

export const weatherReporterAgent = new Agent({
  name: 'weatherExplainerAgent',
  model: openai('gpt-4o'),
  instructions: `
  You are a weather explainer. You have access to input that will help you get weather-specific activities for any city. 
  The tool uses agents to plan the activities, you just need to provide the city. Explain the weather report like a weather reporter.
  `,
});
