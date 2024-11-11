import { Agent } from "../..";
import { integrations } from "../integrations";
import * as tools from "../tools";

export const agentOne = new Agent<typeof tools, typeof integrations>({
    name: 'Agent One',
    instructions: 'Do this',
    model: {
        provider: "OPEN_AI_VERCEL",
        name: "gpt-3.5-turbo",
        toolChoice: 'required',
    },
    tools: {
        testTool: true,
        gmailGetProfile: true,
    }
})
