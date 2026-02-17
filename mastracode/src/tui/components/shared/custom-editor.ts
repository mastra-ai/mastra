import {
    Editor,
    matchesKey,
    type EditorTheme,
    type TUI,
} from "@mariozechner/pi-tui"

type EditorAction =
    | "clear"
    | "undo"
    | "toggleThinking"
    | "expandTools"
    | "followUp"
    | "cycleMode"
    | "toggleYolo"

export class CustomEditor extends Editor {
    private handlers = new Map<EditorAction, () => void>()

    onImagePaste?: (image: { data: string; mimeType: string }) => void
    onCtrlD?: () => void
    escapeEnabled = true

    constructor(tui: TUI, theme: EditorTheme) {
        super(tui, theme)
    }

    onAction(action: EditorAction, callback: () => void): void {
        this.handlers.set(action, callback)
    }

    private triggerAction(action: EditorAction): void {
        this.handlers.get(action)?.()
    }

    override handleInput(data: string): void {
        if (matchesKey(data, "ctrl+c")) {
            this.triggerAction("clear")
            return
        }
        if (matchesKey(data, "escape") && this.escapeEnabled) {
            this.triggerAction("clear")
            return
        }
        if (matchesKey(data, "ctrl+d")) {
            if (this.getText().length === 0) {
                this.onCtrlD?.()
            }
            return
        }
        if (matchesKey(data, "ctrl+z")) {
            this.triggerAction("undo")
            return
        }
        if (matchesKey(data, "ctrl+t")) {
            this.triggerAction("toggleThinking")
            return
        }
        if (matchesKey(data, "ctrl+e")) {
            this.triggerAction("expandTools")
            return
        }
        if (matchesKey(data, "ctrl+f")) {
            this.triggerAction("followUp")
            return
        }
        if (matchesKey(data, "shift+tab")) {
            this.triggerAction("cycleMode")
            return
        }
        if (matchesKey(data, "ctrl+y")) {
            this.triggerAction("toggleYolo")
            return
        }

        super.handleInput(data)
    }
}

