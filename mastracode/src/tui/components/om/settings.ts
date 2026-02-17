import { Container, Spacer, Text } from "@mariozechner/pi-tui"

export interface OMSettings {
    enabled: boolean
    minImportance?: number
    minNovelty?: number
}

export class OMSettingsComponent extends Container {
    constructor(settings: OMSettings) {
        super()
        this.addChild(new Spacer(1))
        this.addChild(
            new Text(
                `[om:settings] enabled=${settings.enabled} importance=${settings.minImportance ?? "n/a"} novelty=${settings.minNovelty ?? "n/a"}`,
                0,
                0,
            ),
        )
    }
}

