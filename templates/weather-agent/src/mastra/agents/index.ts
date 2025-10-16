import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { Agent } from '@mastra/core/agent';
// import { Memory } from '@mastra/memory';

// import { OpenAIVoice } from '@mastra/voice-openai';

import { weatherTool } from '../tools';
import {
  toolCallAppropriatenessScorer,
  promptAlignmentScorer,
  completenessScorer,
  translationScorer,
} from '../scorers';

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
  scorers: {
    promptAlignment: {
      scorer: promptAlignmentScorer,
    },
    translation: {
      scorer: translationScorer,
    },
    completeness: {
      scorer: completenessScorer,
    },
    toolUseAppropriateness: {
      scorer: toolCallAppropriatenessScorer,
    },
  },
  // memory,
  // voice,
});
