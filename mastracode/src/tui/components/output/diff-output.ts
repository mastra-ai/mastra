import { Container, Spacer, Text } from "@mariozechner/pi-tui"

export class DiffOutputComponent extends Container {
    constructor(diffText: string) {
        super()
        this.addChild(new Spacer(1))
        this.addChild(new Text("[diff]", 0, 0))
        this.addChild(new Text(diffText, 0, 0))
    }
}

