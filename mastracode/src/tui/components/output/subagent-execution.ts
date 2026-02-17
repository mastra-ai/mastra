import { Container, Spacer, Text } from "@mariozechner/pi-tui"

export class SubagentExecutionComponent extends Container {
    constructor(agentName: string, status: string) {
        super()
        this.addChild(new Spacer(1))
        this.addChild(new Text(`[subagent] ${agentName}: ${status}`, 0, 0))
    }
}

