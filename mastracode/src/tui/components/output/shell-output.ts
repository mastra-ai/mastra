import { Container, Spacer, Text } from "@mariozechner/pi-tui"

export class ShellOutputComponent extends Container {
    constructor(command: string, output: string) {
        super()
        this.addChild(new Spacer(1))
        this.addChild(new Text(`[shell] ${command}`, 0, 0))
        this.addChild(new Text(output, 0, 0))
    }
}

