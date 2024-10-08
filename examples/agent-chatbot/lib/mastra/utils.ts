export function getAgentBlueprint(agentId: string) {
    const agentBlueprint = require(`../../agents/${agentId}.json`)
    return agentBlueprint
}
