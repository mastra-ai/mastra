import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { createLogger } from "@mastra/core/logger"
import { Mastra } from "@mastra/core/mastra"

export const myAgent = new Agent({
  name: "My Agent",
  instructions: "You are a helpful assistant.",
  model: openai("gpt-4o-mini"),
});

const agents = {
	myAgent
}

export type AgentName = keyof typeof agents

export const mastra = new Mastra({
	agents,
	logger: createLogger({
		name: "Mastra",
		level: "info"
	}),
})

export const getAgent = (agent: AgentName) => {
	return mastra.getAgent(agent)
}
