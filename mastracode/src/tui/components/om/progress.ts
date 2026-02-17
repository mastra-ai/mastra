import { Container, Text } from "@mariozechner/pi-tui"
import chalk from "chalk"
import { fg, mastra } from "../../theme"

export type OMStatus = "idle" | "observing" | "reflecting"
export type OMBufferedStatus = "idle" | "running" | "complete"

export interface OMProgressState {
    status: OMStatus
    pendingTokens: number
    threshold: number
    thresholdPercent: number
    observationTokens: number
    reflectionThreshold: number
    reflectionThresholdPercent: number
    buffered: {
        observations: {
            status: OMBufferedStatus
            chunks: number
            messageTokens: number
            projectedMessageRemoval: number
            observationTokens: number
        }
        reflection: {
            status: OMBufferedStatus
            inputObservationTokens: number
            observationTokens: number
        }
    }
    generationCount: number
    stepNumber: number
    cycleId?: string
    startTime?: number
    // Compatibility shape used by current local TUI event code.
    observing?: boolean
    reflecting?: boolean
    bufferingMessages?: boolean
    bufferingObservations?: boolean
}

export function defaultOMProgressState(): OMProgressState {
    return {
        status: "idle",
        pendingTokens: 0,
        threshold: 30000,
        thresholdPercent: 0,
        observationTokens: 0,
        reflectionThreshold: 40000,
        reflectionThresholdPercent: 0,
        buffered: {
            observations: {
                status: "idle",
                chunks: 0,
                messageTokens: 0,
                projectedMessageRemoval: 0,
                observationTokens: 0,
            },
            reflection: {
                status: "idle",
                inputObservationTokens: 0,
                observationTokens: 0,
            },
        },
        generationCount: 0,
        stepNumber: 0,
        observing: false,
        reflecting: false,
        bufferingMessages: false,
        bufferingObservations: false,
    }
}

export class OMProgressComponent extends Container {
    private state: OMProgressState = defaultOMProgressState()
    private statusText: Text
    private spinnerFrame = 0

    constructor(state: OMProgressState = defaultOMProgressState()) {
        super()
        this.statusText = new Text("")
        this.children.push(this.statusText)
        this.update(state)
    }

    update(state: OMProgressState): void {
        this.state = normalizeState(state, this.state)
        this.updateDisplay()
        this.invalidate()
    }

    private updateDisplay(): void {
        if (this.state.status === "idle") {
            if (this.state.thresholdPercent > 0) {
                const percent = Math.round(this.state.thresholdPercent)
                const bar = this.renderProgressBar(percent, 10)
                this.statusText.setText(fg("muted", `OM ${bar} ${percent}%`))
            } else {
                this.statusText.setText("")
            }
            return
        }
        if (this.state.status === "observing") {
            const elapsed = this.state.startTime
                ? Math.round((Date.now() - this.state.startTime) / 1000)
                : 0
            this.statusText.setText(
                chalk.hex(mastra.orange)(`${this.getSpinner()} Observing... ${elapsed}s`),
            )
            return
        }
        const elapsed = this.state.startTime
            ? Math.round((Date.now() - this.state.startTime) / 1000)
            : 0
        this.statusText.setText(
            chalk.hex(mastra.pink)(`${this.getSpinner()} Reflecting... ${elapsed}s`),
        )
    }

    private renderProgressBar(percent: number, width: number): string {
        const filled = Math.min(width, Math.round((percent / 100) * width))
        const empty = width - filled
        const bar = "━".repeat(filled) + "─".repeat(empty)
        if (percent >= 90) return chalk.hex(mastra.red)(bar)
        if (percent >= 70) return chalk.hex(mastra.orange)(bar)
        return chalk.hex(mastra.darkGray)(bar)
    }

    private getSpinner(): string {
        const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
        this.spinnerFrame = (this.spinnerFrame + 1) % frames.length
        return frames[this.spinnerFrame]!
    }

    render(maxWidth: number): string[] {
        this.updateDisplay()
        return this.statusText.render(maxWidth)
    }
}

function formatTokensValue(n: number): string {
    if (n === 0) return "0"
    const k = n / 1000
    const s = k.toFixed(1)
    return s.endsWith(".0") ? s.slice(0, -2) : s
}

function formatTokensThreshold(n: number): string {
    const k = n / 1000
    const s = k.toFixed(1)
    return `${s.endsWith(".0") ? s.slice(0, -2) : s}k`
}

function colorByPercent(text: string, percent: number): string {
    if (percent >= 90) return chalk.hex(mastra.red)(text)
    if (percent >= 70) return chalk.hex(mastra.orange)(text)
    return chalk.hex(mastra.darkGray)(text)
}

export function formatObservationStatus(
    state: OMProgressState,
    compact?: "percentOnly" | "noBuffer" | "full",
    labelStyler?: (label: string) => string,
): string {
    const percent = Math.round(state.thresholdPercent)
    const pct = colorByPercent(`${percent}%`, percent)
    const style = labelStyler ?? ((s: string) => chalk.hex(mastra.specialGray)(s))
    if (compact === "percentOnly") return style("msg ") + pct
    const label = compact === "full" ? "messages" : "msg"
    const fraction = `${formatTokensValue(state.pendingTokens)}/${formatTokensThreshold(state.threshold)}`
    const buffered =
        compact !== "noBuffer" && state.buffered.observations.projectedMessageRemoval > 0
            ? chalk.hex("#555")(
                ` ↓${formatTokensThreshold(state.buffered.observations.projectedMessageRemoval)}`,
            )
            : ""
    return style(`${label} `) + colorByPercent(fraction, percent) + buffered
}

export function formatReflectionStatus(
    state: OMProgressState,
    compact?: "percentOnly" | "noBuffer" | "full",
    labelStyler?: (label: string) => string,
): string {
    const percent = Math.round(state.reflectionThresholdPercent)
    const pct = colorByPercent(`${percent}%`, percent)
    const style = labelStyler ?? ((s: string) => chalk.hex(mastra.specialGray)(s))
    const label = style(compact === "full" ? "memory" : "mem") + " "
    if (compact === "percentOnly") return label + pct
    const fraction = `${formatTokensValue(state.observationTokens)}/${formatTokensThreshold(state.reflectionThreshold)}`
    const savings =
        state.buffered.reflection.inputObservationTokens -
        state.buffered.reflection.observationTokens
    const buffered =
        compact !== "noBuffer" && state.buffered.reflection.status === "complete"
            ? chalk.hex("#555")(` ↓${formatTokensThreshold(savings)}`)
            : ""
    return label + colorByPercent(fraction, percent) + buffered
}

export function formatOMStatus(state: OMProgressState): string {
    return formatObservationStatus(state)
}

function normalizeState(
    next: OMProgressState,
    prev: OMProgressState,
): OMProgressState {
    const statusFromBooleans =
        next.observing === true
            ? "observing"
            : next.reflecting === true
                ? "reflecting"
                : "idle"

    const merged: OMProgressState = {
        ...prev,
        ...next,
        status: next.status ?? statusFromBooleans,
    }

    merged.buffered = {
        observations: {
            ...prev.buffered.observations,
            ...next.buffered?.observations,
            status:
                next.buffered?.observations?.status ??
                (next.bufferingMessages ? "running" : prev.buffered.observations.status),
        },
        reflection: {
            ...prev.buffered.reflection,
            ...next.buffered?.reflection,
            status:
                next.buffered?.reflection?.status ??
                (next.bufferingObservations
                    ? "running"
                    : prev.buffered.reflection.status),
        },
    }
    return merged
}

