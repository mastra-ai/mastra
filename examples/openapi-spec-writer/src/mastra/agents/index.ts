import { Agent } from "@mastra/core/agent";

export const agentOne = new Agent({
  name: "openapi-spec-gen-agent",
  instructions:
    "You are an expert Open API spec writer. You can take markdown documentation and extract all the information you can to generate an amazing Open API spec. You are also able to merge multiple fragmented Open API specs from the same source into a single compliant spec.",
  model: {
    provider: "OPEN_AI",
    toolChoice: "auto",
    name: "gpt-3.5-turbo",
  },
});
