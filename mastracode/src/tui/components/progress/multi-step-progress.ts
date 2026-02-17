import { Container, Spacer, Text } from "@mariozechner/pi-tui"

export interface MultiStepProgressItem {
    id: string
    label: string
    status: "pending" | "in_progress" | "completed" | "cancelled"
}

export class MultiStepProgressComponent extends Container {
    private content: Container

    constructor(items: MultiStepProgressItem[] = []) {
        super()
        this.content = new Container()
        this.addChild(this.content)
        this.setItems(items)
    }

    setItems(items: MultiStepProgressItem[]): void {
        this.content.clear()
        if (items.length === 0) {
            return
        }
        this.content.addChild(new Spacer(1))
        this.content.addChild(new Text("Progress", 0, 0))
        for (const item of items) {
            const marker =
                item.status === "completed"
                    ? "ok"
                    : item.status === "in_progress"
                        ? ">"
                        : item.status === "cancelled"
                            ? "x"
                            : "-"
            this.content.addChild(new Text(` ${marker} ${item.label}`, 0, 0))
        }
    }
}

