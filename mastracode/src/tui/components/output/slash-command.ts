import { Container, Spacer, Text } from "@mariozechner/pi-tui"

export class SlashCommandComponent extends Container {
    private expanded = false
    private content: Container
    private command: string
    private result: string

    constructor(command: string, result: string) {
        super()
        this.command = command
        this.result = result
        this.content = new Container()
        this.addChild(this.content)
        this.renderContent()
    }

    setExpanded(expanded: boolean): void {
        this.expanded = expanded
        this.renderContent()
    }

    private renderContent(): void {
        this.content.clear()
        this.content.addChild(new Spacer(1))
        this.content.addChild(new Text(`[slash] ${this.command}`, 0, 0))
        if (this.expanded) {
            this.content.addChild(new Text(this.result, 0, 0))
        }
    }
}

