import { Container, Spacer, Text } from "@mariozechner/pi-tui"

export type ApprovalAction = "approve" | "decline"

export class ToolApprovalDialogComponent extends Container {
    constructor(
        toolName: string,
        onDecision: (decision: ApprovalAction) => void,
    ) {
        super()
        this.addChild(new Spacer(1))
        this.addChild(
            new Text(
                `[approval] ${toolName} requested. Type 'y' to approve or 'n' to deny.`,
                0,
                0,
            ),
        )
        // Keep callback for parity with upstream dialog shape.
        this.onDecision = onDecision
    }

    readonly onDecision: (decision: ApprovalAction) => void
}

