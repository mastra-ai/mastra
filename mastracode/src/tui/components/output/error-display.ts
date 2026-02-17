import { Container, Spacer, Text, type TUI } from "@mariozechner/pi-tui"
import { bg, bold, fg } from "../../theme"
import { CollapsibleComponent } from "../shared/collapsible"

interface ErrorInfo {
    message: string
    name?: string
    stack?: string
}

function parseErrorInfo(error: Error | string): ErrorInfo {
    if (typeof error === "string") {
        const lines = error.split("\n").filter((line) => line.trim())
        const firstLine = lines[0] || ""
        const m = firstLine.match(/^([A-Z][a-zA-Z]*Error):\s*(.+)$/)
        if (m) {
            return { name: m[1], message: m[2], stack: lines.slice(1).join("\n") }
        }
        return {
            message: firstLine,
            stack: lines.length > 1 ? lines.slice(1).join("\n") : undefined,
        }
    }
    return { name: error.name, message: error.message, stack: error.stack }
}

export class ErrorDisplayComponent extends Container {
    constructor(
        error: Error | string,
        options: { showStack?: boolean; expanded?: boolean } = {},
        ui?: TUI,
    ) {
        super()
        const info = parseErrorInfo(error)
        this.addChild(new Spacer(1))
        this.addChild(new Text(fg("error", `┌─ Error ${"─".repeat(40)}┐`), 0, 0))
        const name = info.name && info.name !== "Error" ? `${info.name}: ` : ""
        this.addChild(new Text(`│ ${bg("errorBg", ` ${bold(fg("error", `${name}${info.message}`))} `)}`, 0, 0))
        if (options.showStack && info.stack && ui) {
            this.addChild(new Spacer(1))
            const stackSection = new CollapsibleComponent(
                {
                    header: "Stack Trace",
                    expanded: options.expanded ?? false,
                    collapsedLines: 5,
                    expandedLines: 100,
                    showLineCount: true,
                },
                ui,
            )
            stackSection.setContent(info.stack)
            this.addChild(
                stackSection,
            )
        }
        this.addChild(new Text(fg("error", `└${"─".repeat(50)}┘`), 0, 0))
    }
}

