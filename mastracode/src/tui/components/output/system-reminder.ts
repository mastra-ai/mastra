import { Container, Spacer, Text } from "@mariozechner/pi-tui"

export class SystemReminderComponent extends Container {
    constructor(message: string) {
        super()
        this.addChild(new Spacer(1))
        this.addChild(new Text(`[system] ${message}`, 0, 0))
    }
}

