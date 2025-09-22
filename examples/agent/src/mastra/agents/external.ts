import { toMastraCompatible } from "@mastra/agent-compat";
import { z } from "zod";
// npm install @langchain/anthropic to call the model
import { createAgent, tool } from "langchain";

const getWeather = tool(({ city }) => `It's always sunny in ${city}!`, {
    name: "get_weather",
    description: "Get the weather for a given city",
    schema: z.object({
        city: z.string(),
    }),
});

const agent = createAgent({
    name: "langchain-compatible",
    prompt: "Hi",
    model: "openai:gpt-4o-mini",
    tools: [getWeather],
});

export const mastraCompatible = toMastraCompatible({
    agent: agent as any,
});