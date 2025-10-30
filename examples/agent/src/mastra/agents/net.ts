import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { weatherInfo } from '../tools/index.js';
import { lessComplexWorkflow } from '../workflows/index.js';
import { openai as openai_v5 } from '@ai-sdk/openai-v5';

export const subAgent = new Agent({
  name: 'Sub Agent',
  instructions: `You are a helpful sub agent that provides accurate weather information.`,
  model: 'google/gemini-2.5-pro',
});

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
  model: openai_v5('gpt-4o-mini'),
  tools: { weatherInfo },
  agents: { subAgent },
  workflows: { lessComplexWorkflow },
  memory: new Memory(),
});
