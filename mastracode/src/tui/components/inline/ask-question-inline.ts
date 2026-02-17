import { Container, Text } from "@mariozechner/pi-tui"
import type { AskQuestionDialogQuestion } from "../dialogs/ask-question-dialog"

export class AskQuestionInlineComponent extends Container {
    constructor(
        question: AskQuestionDialogQuestion,
        onSubmit: (answers: string[]) => void,
    ) {
        super()
        this.addChild(new Text(`[ask] ${question.prompt}`, 0, 0))
        this.onSubmit = onSubmit
    }

    readonly onSubmit: (answers: string[]) => void

    handleInput(_data: string): void {
        // Input routing hook retained for runner integration.
    }
}

