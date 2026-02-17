import { Container, Spacer, Text } from "@mariozechner/pi-tui"

export interface LoginProvider {
    id: string
    label: string
}

export class LoginSelectorComponent extends Container {
    constructor(
        providers: LoginProvider[],
        onSelect: (providerId: string) => void,
    ) {
        super()
        this.addChild(new Spacer(1))
        this.addChild(new Text("Select login provider:", 0, 0))
        for (const provider of providers) {
            this.addChild(new Text(` - ${provider.id}: ${provider.label}`, 0, 0))
        }
        this.onSelect = onSelect
    }

    readonly onSelect: (providerId: string) => void
}

