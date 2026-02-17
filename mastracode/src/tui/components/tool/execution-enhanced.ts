import * as os from "node:os"
import { Box, Container, Spacer, Text } from "@mariozechner/pi-tui"
import { theme } from "../../theme"
import { ErrorDisplayComponent } from "../output/error-display"
import type {
    IToolExecutionComponent,
    ToolResult,
    ToolResultPart,
} from "./execution-interface"
import {
    parseValidationErrors,
    ToolValidationErrorComponent,
} from "./validation-error"

export type { ToolResult }

export class ToolExecutionComponentEnhanced
    extends Container
    implements IToolExecutionComponent {
    private contentBox: Box
    private args: unknown
    private result?: ToolResult
    private expanded = false
    private isPartial = true
    private startTime = Date.now()
    private streamingOutput = ""

    constructor(
        private toolName: string,
        args: unknown,
    ) {
        super()
        this.args = args
        this.addChild(new Spacer(1))
        this.contentBox = new Box(1, 1, (text: string) =>
            theme.bg("toolPendingBg", text),
        )
        this.addChild(this.contentBox)
        this.rebuild()
    }

    updateArgs(args: unknown): void {
        this.args = args
        this.rebuild()
    }

    updateResult(result: ToolResult, isPartial = false): void {
        this.result = result
        this.isPartial = isPartial
        this.rebuild()
    }

    appendStreamingOutput(output: string): void {
        this.streamingOutput += output
        this.rebuild()
    }

    setExpanded(expanded: boolean): void {
        this.expanded = expanded
        this.rebuild()
    }

    private rebuild(): void {
        this.contentBox.clear()
        this.updateBgColor()
        const status = this.statusIndicator()
        const header = `${theme.bold(theme.fg("toolTitle", this.toolLabel()))}${status}`

        const output = this.formattedOutput()
        const visibleOutput = this.expanded ? output : truncateLines(output, 18)

        if (this.isPartial && !output.trim()) {
            this.contentBox.addChild(new Text(`${header} ${this.argsSummary()}`, 0, 0))
            return
        }

        if (!this.isPartial && this.result?.isError) {
            this.contentBox.addChild(new Text(`${header} ${this.argsSummary()}`, 0, 0))
            if (looksLikeValidationError(output)) {
                this.contentBox.addChild(
                    new ToolValidationErrorComponent({
                        toolName: this.toolName,
                        errors: parseValidationErrors(output),
                        args: this.args,
                    }),
                )
            } else if (output.trim()) {
                this.contentBox.addChild(
                    new ErrorDisplayComponent(output, {
                        showStack: true,
                        expanded: this.expanded,
                    }),
                )
            }
            return
        }

        if (this.isFramedTool()) {
            const border = (c: string) => theme.bold(theme.fg("accent", c))
            this.contentBox.addChild(new Text(border("┌──"), 0, 0))
            if (visibleOutput.trim()) {
                const maxLineWidth = (process.stdout.columns || 80) - 6
                const lines = visibleOutput.split("\n").map((line) => {
                    return `${border("│")} ${truncateAnsi(line, maxLineWidth)}`
                })
                this.contentBox.addChild(new Text(lines.join("\n"), 0, 0))
            }
            const footer = `${header} ${this.argsSummary()}${this.durationSuffix()}`
            this.contentBox.addChild(new Text(`${border("└──")} ${footer}`, 0, 0))
            return
        }

        this.contentBox.addChild(new Text(`${header} ${this.argsSummary()}`, 0, 0))
        if (visibleOutput.trim()) {
            this.contentBox.addChild(new Text(visibleOutput, 0, 0))
        }
    }

    private isFramedTool(): boolean {
        return (
            this.toolName.includes("execute_command") ||
            this.toolName.includes("read_file") ||
            this.toolName === "view" ||
            this.toolName.includes("edit_file") ||
            this.toolName === "string_replace_lsp"
        )
    }

    private toolLabel(): string {
        if (this.toolName.includes("execute_command")) return "$"
        if (this.toolName.includes("read_file") || this.toolName === "view") return "view"
        if (this.toolName.includes("edit_file") || this.toolName === "string_replace_lsp")
            return "edit"
        return this.toolName
    }

    private argsSummary(): string {
        const argsObj = this.args as Record<string, unknown> | undefined
        if (!argsObj || typeof argsObj !== "object") return ""
        if (argsObj.path) {
            return theme.fg("accent", shortenPath(String(argsObj.path)))
        }
        if (argsObj.command) {
            return theme.fg("accent", String(argsObj.command))
        }
        const keys = Object.keys(argsObj)
        return theme.fg("muted", keys.length > 0 ? `(${keys.length} args)` : "")
    }

    private formattedOutput(): string {
        const text = this.getResultText()
        if (!text.trim()) return this.streamingOutput
        return text.trim().replace(/\n\s*\n\s*\n/g, "\n\n")
    }

    private getResultText(): string {
        if (!this.result) return ""
        const content = this.result.content
        if (typeof content === "string") return content
        const parts = content as ToolResultPart[]
        return parts
            .filter((p) => p.type === "text" && p.text)
            .map((p) => p.text || "")
            .join("\n")
    }

    private statusIndicator(): string {
        if (this.isPartial) return theme.fg("muted", " ⋯")
        return this.result?.isError ? theme.fg("error", " ✗") : theme.fg("success", " ✓")
    }

    private durationSuffix(): string {
        if (this.isPartial) return ""
        const ms = Date.now() - this.startTime
        return ms < 1000 ? theme.fg("muted", ` ${ms}ms`) : theme.fg("muted", ` ${(ms / 1000).toFixed(1)}s`)
    }

    private updateBgColor(): void {
        const color = this.isPartial
            ? "toolPendingBg"
            : this.result?.isError
                ? "toolErrorBg"
                : "toolSuccessBg"
        this.contentBox.setBgFn((text: string) => theme.bg(color, text))
    }
}

function shortenPath(path: string): string {
    const home = os.homedir()
    return path.startsWith(home) ? `~${path.slice(home.length)}` : path
}

function truncateLines(text: string, maxLines: number): string {
    const lines = text.split("\n")
    if (lines.length <= maxLines) return text
    const remaining = lines.length - maxLines
    return `${lines.slice(0, maxLines).join("\n")}\n${theme.fg("muted", `... ${remaining} more lines (ctrl+e to expand)`)}`
}

function truncateAnsi(str: string, maxWidth: number): string {
    // eslint-disable-next-line no-control-regex
    const ansiRegex = /\x1b\[[0-9;]*m|\x1b\]8;[^\x07]*\x07/g
    let visibleLength = 0
    let result = ""
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = ansiRegex.exec(str)) !== null) {
        const textBefore = str.slice(lastIndex, match.index)
        const remaining = maxWidth - visibleLength
        if (textBefore.length <= remaining) {
            result += textBefore
            visibleLength += textBefore.length
        } else {
            result += `${textBefore.slice(0, Math.max(0, remaining - 1))}…`
            return result
        }
        result += match[0]
        lastIndex = match.index + match[0].length
    }
    const remaining = str.slice(lastIndex)
    const spaceLeft = maxWidth - visibleLength
    if (remaining.length <= spaceLeft) {
        result += remaining
    } else {
        result += `${remaining.slice(0, Math.max(0, spaceLeft - 1))}…`
    }
    return result
}

function looksLikeValidationError(text: string): boolean {
    const lower = text.toLowerCase()
    return (
        lower.includes("validation") ||
        lower.includes("required parameter") ||
        lower.includes("missing required") ||
        /at "\w+"/i.test(text) ||
        (text.includes("Expected") && text.includes("Received"))
    )
}

