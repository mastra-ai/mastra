import { Container, Text } from "@mariozechner/pi-tui"

export class SimpleProgressComponent extends Container {
    private textNode: Text

    constructor(label = "Working...") {
        super()
        this.textNode = new Text(label, 0, 0)
        this.addChild(this.textNode)
    }

    setLabel(label: string): void {
        this.clear()
        this.textNode = new Text(label, 0, 0)
        this.addChild(this.textNode)
        this.invalidate()
    }
}

