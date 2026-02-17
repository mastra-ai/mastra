import { Container, Text, type TUI } from "@mariozechner/pi-tui"
import { highlight } from "cli-highlight"
import { theme } from "../../theme"

export interface CollapsibleOptions {
    expanded?: boolean
    header: string | Container
    summary?: string
    collapsedLines?: number
    expandedLines?: number
    showLineCount?: boolean
}

export class CollapsibleComponent extends Container {
    private expanded: boolean
    private header: string | Container
    protected summary?: string
    private content: string[] = []
    private options: CollapsibleOptions
    private ui: TUI

    constructor(options: CollapsibleOptions, ui: TUI) {
        super()
        this.options = {
            expanded: false,
            collapsedLines: 10,
            expandedLines: 100,
            showLineCount: true,
            ...options,
        }
        this.expanded = this.options.expanded ?? false
        this.header = options.header
        this.summary = options.summary
        this.ui = ui
        this.updateDisplay()
    }

    setContent(content: string | string[]): void {
        this.content = Array.isArray(content) ? content : content.split("\n")
        this.updateDisplay()
    }

    isExpanded(): boolean {
        return this.expanded
    }

    setExpanded(expanded: boolean): void {
        this.expanded = expanded
        this.updateDisplay()
    }

    toggle(): void {
        this.expanded = !this.expanded
        this.updateDisplay()
    }

    private updateDisplay(): void {
        this.clear()
        const lineCount =
            this.options.showLineCount && this.content.length > 0
                ? theme.fg("muted", ` (${this.content.length} lines)`)
                : ""

        const headerText =
            typeof this.header === "string"
                ? `${this.header}${lineCount}`
                : this.header

        if (typeof headerText === "string") {
            this.addChild(new Text(headerText, 0, 0))
        } else {
            this.addChild(headerText)
        }

        if (!this.expanded && this.summary) {
            this.addChild(new Text(theme.fg("muted", this.summary), 0, 0))
            return
        }
        if (this.content.length === 0) return

        const maxLines = this.expanded
            ? this.options.expandedLines!
            : this.options.collapsedLines!
        if (maxLines === 0 && !this.expanded) return

        const linesToShow = Math.min(this.content.length, maxLines)
        const hasMore = this.content.length > maxLines
        for (let i = 0; i < linesToShow; i++) {
            this.addChild(new Text(this.content[i]!, 0, 0))
        }
        if (hasMore) {
            const remaining = this.content.length - linesToShow
            const action = this.expanded ? "collapse" : "expand"
            this.addChild(
                new Text(
                    theme.fg("muted", `... ${remaining} more lines (Ctrl+E to ${action} all)`),
                    0,
                    0,
                ),
            )
        }
    }
}

export class CollapsibleFileViewer extends CollapsibleComponent {
    constructor(
        path: string,
        content: string,
        options: Partial<CollapsibleOptions>,
        ui: TUI,
    ) {
        const lines = content.split("\n").map((line) => line.trimEnd())
        let codeLines = lines
        if (lines.length > 0 && lines[0]!.includes("Here's the result of running")) {
            codeLines = lines.slice(1)
        }
        codeLines = codeLines.map((line) => line.replace(/^\s*\d+\t/, ""))
        while (codeLines.length > 0 && codeLines[codeLines.length - 1] === "") {
            codeLines.pop()
        }

        let highlightedLines = codeLines
        try {
            const highlighted = highlight(codeLines.join("\n"), {
                language: getLanguageFromPath(path),
                ignoreIllegals: true,
            })
            highlightedLines = highlighted.split("\n")
        } catch { }

        const header = `${theme.bold(theme.fg("toolTitle", "view"))} ${theme.fg("accent", path)}`
        super(
            {
                header,
                collapsedLines: 20,
                expandedLines: 200,
                showLineCount: true,
                ...options,
            },
            ui,
        )
        this.setContent(highlightedLines)
    }
}

function getLanguageFromPath(path: string): string | undefined {
    const ext = path.split(".").pop()?.toLowerCase()
    const langMap: Record<string, string> = {
        ts: "typescript",
        tsx: "typescript",
        js: "javascript",
        jsx: "javascript",
        json: "json",
        md: "markdown",
        py: "python",
        rb: "ruby",
        rs: "rust",
        go: "go",
        java: "java",
        css: "css",
        scss: "scss",
        sql: "sql",
        yml: "yaml",
        yaml: "yaml",
    }
    return ext ? langMap[ext] : undefined
}

export const Collapsible = CollapsibleComponent

