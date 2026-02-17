import { Container, Spacer, Text } from "@mariozechner/pi-tui"

export class LoginDialogComponent extends Container {
    constructor(onLogin: () => void) {
        super()
        this.addChild(new Spacer(1))
        this.addChild(new Text("[login] Sign in required.", 0, 0))
        this.onLogin = onLogin
    }

    readonly onLogin: () => void
}

