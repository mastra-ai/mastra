import { Container, Spacer, Text } from "@mariozechner/pi-tui"

export interface SettingsItem {
    key: string
    label: string
    value: string | number | boolean
}

export class SettingsComponent extends Container {
    constructor(items: SettingsItem[]) {
        super()
        this.addChild(new Spacer(1))
        this.addChild(new Text("Settings", 0, 0))
        for (const item of items) {
            this.addChild(new Text(` - ${item.label}: ${String(item.value)}`, 0, 0))
        }
    }
}

