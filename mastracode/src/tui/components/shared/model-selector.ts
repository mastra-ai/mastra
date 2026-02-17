import { Container, Spacer, Text } from "@mariozechner/pi-tui"

export interface ModelItem {
    id: string
    label: string
    description?: string
}

export class ModelSelectorComponent extends Container {
    constructor(
        models: ModelItem[],
        currentId: string,
        onSelect: (id: string) => void,
    ) {
        super()
        this.addChild(new Spacer(1))
        this.addChild(new Text("Available models:", 0, 0))
        for (const model of models) {
            const marker = model.id === currentId ? "*" : " "
            this.addChild(
                new Text(
                    ` ${marker} ${model.id} - ${model.label}${model.description ? ` (${model.description})` : ""}`,
                    0,
                    0,
                ),
            )
        }
        this.onSelect = onSelect
    }

    readonly onSelect: (id: string) => void
}

