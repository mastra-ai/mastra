import { Container, Spacer, Text } from "@mariozechner/pi-tui"

export class OMOutputComponent extends Container {
    constructor(entries: string[] = []) {
        super()
        this.addChild(new Spacer(1))
        this.addChild(new Text("[om] output", 0, 0))
        for (const entry of entries) {
            this.addChild(new Text(` - ${entry}`, 0, 0))
        }
    }
}

