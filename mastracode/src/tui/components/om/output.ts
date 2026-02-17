import { Container, Spacer, Text } from "@mariozechner/pi-tui"
import chalk from "chalk"
import { mastra } from "../../theme"

const OBSERVER_COLOR = "#f59e0b"
const REFLECTOR_COLOR = "#ef4444"
const COLLAPSED_LINES = 10

function formatTokens(tokens: number): string {
    if (tokens === 0) return "0"
    const k = tokens / 1000
    return k % 1 === 0 ? `${k}k` : `${k.toFixed(1)}k`
}

export type OMOutputType = "observation" | "reflection"

export interface OMOutputData {
    type: OMOutputType
    observations: string
    currentTask?: string
    suggestedResponse?: string
    durationMs?: number
    tokensObserved?: number
    observationTokens?: number
    compressedTokens?: number
}

export class OMOutputComponent extends Container {
    private data: OMOutputData
    private expanded = false

    constructor(data: OMOutputData) {
        super()
        this.data = data
        this.rebuild()
    }

    setExpanded(expanded: boolean): void {
        this.expanded = expanded
        this.rebuild()
    }

    toggleExpanded(): void {
        this.setExpanded(!this.expanded)
    }

    private rebuild(): void {
        this.clear()
        this.addChild(new Spacer(1))

        const isReflection = this.data.type === "reflection"
        const color = isReflection ? REFLECTOR_COLOR : OBSERVER_COLOR
        const border = (char: string) => chalk.bold.hex(color)(char)

        const termWidth = process.stdout.columns || 80
        const maxLineWidth = termWidth - 6
        const allLines = this.data.observations.split("\n")
        const lines =
            !this.expanded && allLines.length > COLLAPSED_LINES
                ? [
                    ...allLines.slice(0, 5),
                    `... ${allLines.length} lines total (ctrl+e to expand)`,
                    ...allLines.slice(-4),
                ]
                : allLines

        this.addChild(new Text(border("┌──"), 0, 0))
        for (const line of lines) {
            const clipped = line.length > maxLineWidth ? `${line.slice(0, maxLineWidth - 1)}…` : line
            this.addChild(
                new Text(border("│") + " " + chalk.hex(mastra.specialGray)(clipped), 0, 0),
            )
        }

        if (this.data.currentTask && this.expanded) {
            this.addChild(
                new Text(
                    border("│") +
                    " " +
                    chalk.hex(color).bold("Current task: ") +
                    chalk.hex(mastra.specialGray)(this.data.currentTask),
                    0,
                    0,
                ),
            )
        }
        if (this.data.suggestedResponse && this.expanded) {
            this.addChild(
                new Text(
                    border("│") +
                    " " +
                    chalk.hex(color).bold("Suggested response: ") +
                    chalk.hex(mastra.specialGray)(this.data.suggestedResponse),
                    0,
                    0,
                ),
            )
        }

        this.addChild(new Text(`${border("└──")} ${this.buildFooterText(color)}`, 0, 0))
    }

    private buildFooterText(color: string): string {
        const isReflection = this.data.type === "reflection"
        if (isReflection) {
            const observed = formatTokens(this.data.tokensObserved ?? 0)
            const compressed = formatTokens(
                this.data.compressedTokens ?? this.data.observationTokens ?? 0,
            )
            const ratio =
                (this.data.tokensObserved ?? 0) > 0 &&
                    (this.data.compressedTokens ?? this.data.observationTokens ?? 0) > 0
                    ? `${Math.round((this.data.tokensObserved ?? 0) / (this.data.compressedTokens ?? this.data.observationTokens ?? 1))}x`
                    : ""
            const durationStr = this.data.durationMs
                ? ` in ${(this.data.durationMs / 1000).toFixed(1)}s`
                : ""
            const ratioStr = ratio ? ` (${ratio} compression)` : ""
            return chalk
                .hex(color)(`Reflected: ${observed} -> ${compressed} tokens${ratioStr}${durationStr}`)
        }

        const observed = formatTokens(this.data.tokensObserved ?? 0)
        const compressed = formatTokens(this.data.observationTokens ?? 0)
        const ratio =
            (this.data.tokensObserved ?? 0) > 0 && (this.data.observationTokens ?? 0) > 0
                ? `${Math.round((this.data.tokensObserved ?? 0) / (this.data.observationTokens ?? 1))}x`
                : ""
        const durationStr = this.data.durationMs ? ` in ${(this.data.durationMs / 1000).toFixed(1)}s` : ""
        const ratioStr = ratio ? ` (${ratio} compression)` : ""
        return chalk.hex(color)(`Observed: ${observed} -> ${compressed} tokens${ratioStr}${durationStr}`)
    }
}

