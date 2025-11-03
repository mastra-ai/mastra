import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";

import { weatherTool } from "../tools";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";

export const memory = new Memory({
  storage: new LibSQLStore({
    url: `file:./mastra.db`,
  }),
  options: {
    semanticRecall: false,
    workingMemory: {
      enabled: false,
    },
    lastMessages: 5,
  },
});

export const weatherAgent = new Agent({
  id: "weather-agent",
  name: "Weather Agent",
  instructions: `
      You are a helpful weather assistant that provides accurate weather information.

      Your primary function is to help users get weather details for specific locations. When responding:
      - Always ask for a location if none is provided
      - If giving a location with multiple parts (e.g. "New York, NY"), use the most relevant part (e.g. "New York")
      - Include relevant details like humidity, wind conditions, and precipitation
      - Keep responses concise but informative

      Use the weatherTool to fetch current weather data.

`,
  model: openai("gpt-4o"),
  tools: {
    weatherTool,
  },
  memory,
});
