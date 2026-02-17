export interface ToolResultPart {
    type: string
    text?: string
    data?: string
    mimeType?: string
}

export interface ToolResult {
    content: string | ToolResultPart[]
    isError: boolean
}

export interface IToolExecutionComponent {
    updateArgs(args: unknown): void
    updateResult(result: ToolResult, isPartial?: boolean): void
    setExpanded(expanded: boolean): void
    appendStreamingOutput?(output: string): void
}

