import { getAssistantAgent } from "./assistant"

export async function getAgent({ connectionId, agent, apis }: { connectionId: string, agent: Record<string, any>, apis: Record<string, any> }) {
    if (agent.model.provider === 'OPEN_AI_ASSISTANT') {
        const tools = Object.keys(agent.tools)
        const toolMap = Object.entries(apis).reduce((memo, [k, def]) => {
            if (tools.includes(k)) {
                memo[k] = async (props: any) => {
                    return def.executor({
                        data: props,
                        ctx: { connectionId, triggerEvent: () => {} }
                    })
                }
            }
            return memo
        }, {} as Record<string, any>)

        const assistant = await getAssistantAgent({ id: agent.id, toolMap })
        return assistant
    }
}