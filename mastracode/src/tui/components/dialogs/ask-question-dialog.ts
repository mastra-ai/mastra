import { Container, Spacer, Text } from "@mariozechner/pi-tui"

export interface AskQuestionDialogOption {
    id: string
    label: string
}

export interface AskQuestionDialogQuestion {
    id: string
    prompt: string
    options: AskQuestionDialogOption[]
    allowMultiple?: boolean
}

export class AskQuestionDialogComponent extends Container {
    constructor(
        title: string,
        question: AskQuestionDialogQuestion,
        onSubmit: (answers: string[]) => void,
    ) {
        super()
        this.addChild(new Spacer(1))
        this.addChild(new Text(`[question] ${title}`, 0, 0))
        this.addChild(new Text(question.prompt, 0, 0))
        for (const option of question.options) {
            this.addChild(new Text(` - ${option.id}: ${option.label}`, 0, 0))
        }
        this.onSubmit = onSubmit
    }

    readonly onSubmit: (answers: string[]) => void
}

