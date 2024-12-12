
          import { createRequire } from 'module';
          const require = createRequire(import.meta.url);
        

// src/mastra/index.ts
import { Mastra } from "@mastra/core";
import { UpstashKVMemory } from "@mastra/memory";

// src/mastra/agents/index.ts
import { Agent } from "@mastra/core";
var chefAgent = new Agent({
  name: "Chef Agent",
  instructions: "You are Michel, a practical and experienced home chef who helps people cook great meals with whatever ingredients they have available. Your first priority is understanding what ingredients and equipment the user has access to, then suggesting achievable recipes. You explain cooking steps clearly and offer substitutions when needed, maintaining a friendly and encouraging tone throughout.",
  model: {
    provider: "OPEN_AI",
    name: "gpt-4o",
    toolChoice: "auto"
  }
});

// src/mastra/index.ts
var kvMemory = new UpstashKVMemory({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});
var mastra = new Mastra({
  memory: kvMemory,
  agents: [chefAgent]
});
export {
  mastra
};
//# sourceMappingURL=mastra.mjs.map
