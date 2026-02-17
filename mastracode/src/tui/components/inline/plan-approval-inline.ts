import { Container, Spacer, Text } from "@mariozechner/pi-tui"

export class PlanApprovalInlineComponent extends Container {
    constructor(onDecision: (approved: boolean) => void) {
        super()
        this.addChild(new Spacer(1))
        this.addChild(
            new Text("[plan] Approve proposed plan? (y/n)", 0, 0),
        )
        this.onDecision = onDecision
    }

    readonly onDecision: (approved: boolean) => void

    handleInput(_data: string): void {
        // Input routing hook retained for runner integration.
    }
}

export class PlanResultComponent extends Container {
    constructor(message: string) {
        super()
        this.addChild(new Text(`[plan] ${message}`, 0, 0))
    }
}

