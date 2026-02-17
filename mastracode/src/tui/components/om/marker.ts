import { Container, Text } from "@mariozechner/pi-tui"

export interface OMMarkerData {
    label: string
    active: boolean
}

export class OMMarkerComponent extends Container {
    private textNode: Text

    constructor(data: OMMarkerData) {
        super()
        this.textNode = new Text("", 0, 0)
        this.addChild(this.textNode)
        this.update(data)
    }

    update(data: OMMarkerData): void {
        this.clear()
        this.textNode = new Text(
            `[om:${data.active ? "active" : "idle"}] ${data.label}`,
            0,
            0,
        )
        this.addChild(this.textNode)
        this.invalidate()
    }
}

