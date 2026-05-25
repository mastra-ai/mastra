import { createTool } from '@mastra/core/tools';
import { tool } from 'ai';
import { z } from 'zod';

export const weatherInfo = createTool({
  id: 'weather-info',
  description: 'Fetches the current weather information for a given city',
  inputSchema: z.object({
    city: z.string(),
  }),
  execute: async ({ city }) => {
    return {
      city,
      weather: 'sunny',
      temperature_celsius: 19,
      temperature_fahrenheit: 66,
      humidity: 50,
      wind: '10 mph',
    };
  },
});

// Create a tool using AI SDK's tool() helper
export const weatherTool = tool({
  description: 'Get the current weather for a city',
  inputSchema: z.object({
    city: z.string().describe('The city to get weather for'),
  }),
  outputSchema: z.object({
    city: z.string(),
    weather: z.string(),
    temperature: z.number(),
    unit: z.string(),
  }),
  execute: async ({ city }) => {
    // Simulated weather data
    return {
      city,
      weather: 'sunny',
      temperature: 72,
      unit: 'fahrenheit',
    };
  },
});

export const diceRoll = createTool({
  id: 'dice-roll',
  description: 'Rolls one or more dice with a configurable number of sides',
  inputSchema: z.object({
    sides: z.number().int().min(2).describe('Number of sides per die'),
    count: z.number().int().min(1).max(20).describe('Number of dice to roll'),
  }),
  execute: async ({ sides, count }) => {
    const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
    return {
      sides,
      count,
      rolls,
      total: rolls.reduce((sum, roll) => sum + roll, 0),
    };
  },
});

export const coinFlip = createTool({
  id: 'coin-flip',
  description: 'Flips a coin one or more times and returns the results',
  inputSchema: z.object({
    flips: z.number().int().min(1).max(100).describe('How many times to flip'),
  }),
  execute: async ({ flips }) => {
    const results = Array.from({ length: flips }, () => (Math.random() < 0.5 ? 'heads' : 'tails'));
    return {
      flips,
      results,
      heads: results.filter(r => r === 'heads').length,
      tails: results.filter(r => r === 'tails').length,
    };
  },
});

export const randomQuote = createTool({
  id: 'random-quote',
  description: 'Returns a random inspirational quote',
  inputSchema: z.object({}),
  execute: async () => {
    const quotes = [
      { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
      { text: 'In the middle of difficulty lies opportunity.', author: 'Albert Einstein' },
      { text: 'Whether you think you can or you think you cannot, you are right.', author: 'Henry Ford' },
      { text: 'The future belongs to those who believe in the beauty of their dreams.', author: 'Eleanor Roosevelt' },
      { text: 'Simplicity is the ultimate sophistication.', author: 'Leonardo da Vinci' },
    ];
    return quotes[Math.floor(Math.random() * quotes.length)];
  },
});
