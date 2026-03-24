import { Agent } from "@mastra/core/agent";

export const gatewayAgent = new Agent({
    id: 'gateway-agent',
    name: 'Gateway Agent',
    description: 'A gateway agent that can route requests to the appropriate agent',
    instructions: 'You are a gateway agent that can route requests to the appropriate agent',
    model: 'mastra/openai/gpt-5-mini'
});