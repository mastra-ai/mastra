import { toMastraCompatible, toMastraCompatibleAISDK, toMastraCompatibleOpenAI } from '@mastra/agent-compat';
import { Agent as OpenAIAgent, tool as openaiTool } from '@openai/agents';
import { Experimental_Agent as Agent, stepCountIs, tool as aisdkTool } from 'ai-v5';
import { z } from 'zod';

import { openai } from '@ai-sdk/openai-v5';
// npm install @langchain/anthropic to call the model
import { createAgent, tool } from 'langchain';

const getWeather = tool(({ city }) => `It's always sunny in ${city}!`, {
    name: 'get_weather',
    description: 'Get the weather for a given city',
    schema: z.object({
        city: z.string(),
    }),
});

const agent = createAgent({
    name: 'langchain-compatible',
    prompt: 'Hi',
    model: 'openai:gpt-4o-mini',
    tools: [getWeather],
});

export const weatherAgentLangChain = toMastraCompatible({
    agent: agent as any,
});

const aisdkAgent = new Agent({
    model: openai('gpt-4o-mini'),
    tools: {
        weatherTool: aisdkTool({
            description: 'Get the Weather',
            inputSchema: z.object({
                location: z.string(),
            }),
            execute: async ({ location }) => {
                return { output: `The weather in ${location} is sunny` };
            },
        }),
    },
    stopWhen: [
        stepCountIs(10), // Maximum 10 steps
    ],
    system: `
        You are a helpful weather assistant that provides accurate weather information and can help planning activities based on the weather.

        Your primary function is to help users get weather details for specific locations. When responding:
        - Always ask for a location if none is provided
        - If the location name isn't in English, please translate it
        - If giving a location with multiple parts (e.g. "New York, NY"), use the most relevant part (e.g. "New York")
        - Include relevant details like humidity, wind conditions, and precipitation
        - Keep responses concise but informative
        - If the user asks for activities and provides the weather forecast, suggest activities based on the weather forecast.
        - If the user asks for activities, respond in the format they request.

        Use the weatherTool to fetch current weather data.
    `,
});

export const weatherAgentAISDK = toMastraCompatibleAISDK({
    agent: aisdkAgent as any,
});


const weatherTool = openaiTool({
    name: 'get-weather',
    description: 'Get current weather for a location',
    parameters: z.object({
        location: z.string().describe('City name'),
    }),
    execute: async ({ location }: { location: string }) => {
        return {
            summary: `The current weather in ${location} is sunny`
        };
    },
});

const openaiAgent = new OpenAIAgent({
    name: 'Weather Agent',
    instructions: `
    You are a helpful weather assistant that provides accurate weather information and can help planning activities based on the weather.

    Your primary function is to help users get weather details for specific locations. When responding:
    - Always ask for a location if none is provided
    - If the location name isn't in English, please translate it
    - If giving a location with multiple parts (e.g. "New York, NY"), use the most relevant part (e.g. "New York")
    - Include relevant details like humidity, wind conditions, and precipitation
    - Keep responses concise but informative
    - If the user asks for activities and provides the weather forecast, suggest activities based on the weather forecast
    - If the user asks for activities, respond in the format they request

    Use the get-weather tool to fetch current weather data.
  `,
    tools: [weatherTool],
});

export const weatherAgentOpenAI = toMastraCompatibleOpenAI({
    agent: openaiAgent as any,
});