/**
 * NestJS Mastra Server Example
 *
 * This example demonstrates how to use @mastra/nestjs with both
 * Express (default) and Fastify platforms.
 *
 * Run with Express: npx ts-node examples/index.ts
 * Run with Fastify: PLATFORM=fastify npx ts-node examples/index.ts
 */

import { openai } from '@ai-sdk/openai';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { z } from 'zod';

import { MastraServer } from '../src/index';

// Storage configuration
const storage = new LibSQLStore({
  id: 'nestjs-storage',
  url: 'file:./mastra.db',
});

// Weather tool definition
export const weatherTool = createTool({
  id: 'get-weather',
  description: 'Get current weather for a location',
  inputSchema: z.object({
    location: z.string().describe('City name'),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    feelsLike: z.number(),
    humidity: z.number(),
    windSpeed: z.number(),
    windGust: z.number(),
    conditions: z.string(),
    location: z.string(),
  }),
  execute: async inputData => {
    const location = inputData.location;
    const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`;
    const geocodingResponse = await fetch(geocodingUrl);
    const geocodingData = (await geocodingResponse.json()) as any;

    if (!geocodingData.results?.[0]) {
      throw new Error(`Location '${location}' not found`);
    }

    const { latitude, longitude, name } = geocodingData.results[0];

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,weather_code`;

    const response = await fetch(weatherUrl);
    const data = (await response.json()) as any;

    return {
      temperature: data.current.temperature_2m,
      feelsLike: data.current.apparent_temperature,
      humidity: data.current.relative_humidity_2m,
      windSpeed: data.current.wind_speed_10m,
      windGust: data.current.wind_gusts_10m,
      conditions: getWeatherCondition(data.current.weather_code),
      location: name,
    };
  },
});

function getWeatherCondition(code: number): string {
  const conditions: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    71: 'Slight snow fall',
    73: 'Moderate snow fall',
    75: 'Heavy snow fall',
    95: 'Thunderstorm',
  };
  return conditions[code] || 'Unknown';
}

// Weather agent
export const weatherAgent = new Agent({
  id: 'weather-agent',
  name: 'Weather Agent',
  model: openai('gpt-4o'),
  instructions: `You are a helpful weather assistant. Use the weather tool to get current weather information for locations the user asks about. Provide friendly, informative responses about the weather conditions.`,
  tools: {
    getWeather: weatherTool,
  },
});

// Planning agent
export const planningAgent = new Agent({
  id: 'planning-agent',
  name: 'Planning Agent',
  model: openai('gpt-4o'),
  instructions: `
    You are a local activities and travel expert who excels at weather-based planning.
    Analyze the weather data and provide practical activity recommendations.

    Guidelines:
    - Suggest 2-3 time-specific outdoor activities per day
    - Include 1-2 indoor backup options
    - For precipitation >50%, lead with indoor activities
    - All activities must be specific to the location
    - Include specific venues, trails, or locations
    - Consider activity intensity based on temperature
    - Keep descriptions concise but informative
  `,
  tools: {
    getWeather: weatherTool,
  },
});

// Memory configuration
const memory = new Memory({
  storage,
  options: {
    lastMessages: 10,
    semanticRecall: false,
  },
});

// Workflow example
const greetingStep = createStep({
  id: 'greeting',
  inputSchema: z.object({
    name: z.string(),
  }),
  outputSchema: z.object({
    greeting: z.string(),
  }),
  execute: async ({ inputData }) => {
    return { greeting: `Hello, ${inputData.name}!` };
  },
});

const farewellStep = createStep({
  id: 'farewell',
  inputSchema: z.object({
    greeting: z.string(),
  }),
  outputSchema: z.object({
    message: z.string(),
  }),
  execute: async ({ inputData }) => {
    return { message: `${inputData.greeting} Have a great day!` };
  },
});

const greetingWorkflow = createWorkflow({
  id: 'greeting-workflow',
  inputSchema: z.object({
    name: z.string(),
  }),
  outputSchema: z.object({
    message: z.string(),
  }),
})
  .then(greetingStep)
  .then(farewellStep);

greetingWorkflow.commit();

// Mastra instance
const mastra = new Mastra({
  agents: {
    weatherAgent,
    planningAgent,
  },
  storage,
  memory,
  workflows: {
    greetingWorkflow,
  },
});

// NestJS Module
@Module({})
class AppModule {}

async function bootstrap() {
  const platform = process.env.PLATFORM || 'express';
  const port = parseInt(process.env.PORT || '3000', 10);

  console.info(`Starting NestJS Mastra server with ${platform} platform...`);

  if (platform === 'fastify') {
    // Fastify platform
    const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
      logger: ['error', 'warn', 'log'],
    });

    const server = new MastraServer({
      app,
      mastra,
      openapiPath: '/openapi.json',
      streamOptions: { redact: true },
    });

    await server.init();

    console.info(`Platform detected: ${server.getPlatformType()}`);

    // For Fastify, listen on all interfaces
    await app.listen(port, '0.0.0.0');
    console.info(`Server running on http://localhost:${port}`);
    console.info(`OpenAPI spec available at http://localhost:${port}/openapi.json`);
  } else {
    // Express platform (default)
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log'],
    });

    const server = new MastraServer({
      app,
      mastra,
      openapiPath: '/openapi.json',
      streamOptions: { redact: true },
    });

    await server.init();

    console.info(`Platform detected: ${server.getPlatformType()}`);

    await app.listen(port);
    console.info(`Server running on http://localhost:${port}`);
    console.info(`OpenAPI spec available at http://localhost:${port}/openapi.json`);
  }
}

bootstrap().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
