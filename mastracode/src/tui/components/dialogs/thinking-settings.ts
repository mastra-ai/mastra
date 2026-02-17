import { Container, Spacer, Text } from "@mariozechner/pi-tui"

export class ThinkingSettingsComponent extends Container {
    constructor(
        enabled: boolean,
        onToggle: (enabled: boolean) => void,
    ) {
        super()
        this.addChild(new Spacer(1))
        this.addChild(
            new Text(
                `Thinking visibility: ${enabled ? "enabled" : "hidden"}`,
                0,
                0,
            ),
        )
        this.onToggle = onToggle
    }

    readonly onToggle: (enabled: boolean) => void
}

