import { Mastra } from "..";
import { testTool } from "./tools";
import { agentOne } from "./agents/test";
import { integrations } from "./integrations";

export const mastra = new Mastra({
    tools: {
        testTool
    },
    agents: [
        agentOne,
    ],
    integrations,
})
