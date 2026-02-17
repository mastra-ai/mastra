import { Mastra } from "@mastra/core/mastra"
import { noopLogger } from "@mastra/core/logger"
import type { MastraCompositeStore } from "@mastra/core/storage"
import { Agent } from "@mastra/core/agent";
import { getDynamicModel } from "../model";

export function createCodingAgent(storage: MastraCompositeStore) {
    const codeAgent = new Agent({
        id: "code-agent",
        name: "Code Agent",
        instructions: '',
        model: getDynamicModel,
    });

    const mastraInstance = new Mastra({
        agents: { codeAgent },
        storage,
        logger: noopLogger,
    })

    return mastraInstance.getAgent("codeAgent");
}

