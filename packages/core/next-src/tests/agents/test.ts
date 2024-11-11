import { Agent } from "../..";
import { integrations } from "../integrations";
import * as tools from "../tools";

export const agentOne = new Agent<typeof tools, typeof integrations>({
    id: '1',
    name: 'Agent One',
    instructions: 'Do this',
    model: {
        provider: 'test',
        name: 'test',
        toolChoice: 'required',
    },
    tools: {
        testTool: true,
        gmailGetProfile: true,
    }
})
