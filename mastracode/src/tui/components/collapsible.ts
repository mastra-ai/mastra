/**
 * Generic collapsible container component.
 * Can be used to wrap any content that should be expandable/collapsible.
 */

import { Container, Text  } from "@mariozechner/pi-tui"
import type {TUI} from "@mariozechner/pi-tui";
import { highlight } from "cli-highlight"
import { theme } from "../theme.js"

export interface CollapsibleOptions {
	/** Initial expanded state */
	expanded?: boolean
	/** Header text or component */
	header: string | Container
	/** Summary shown when collapsed */
	summary?: string
	/** Max lines to show when collapsed (0 = fully collapsed) */
	collapsedLines?: number
	/** Max lines to show when expanded */
	expandedLines?: number
	/** Whether to show line count in header */
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

		// Show summary when collapsed if provided
		if (!this.expanded && this.summary) {
			this.addChild(new Text(theme.fg("muted", this.summary), 0, 0))
			return
		}

		// Show content
		if (this.content.length === 0) return

		const maxLines = this.expanded
			? this.options.expandedLines!
			: this.options.collapsedLines!

		if (maxLines === 0 && !this.expanded) {
			// Fully collapsed, show nothing
			return
		}

		const linesToShow = Math.min(this.content.length, maxLines)
		const hasMore = this.content.length > maxLines

		// Add content lines
		for (let i = 0; i < linesToShow; i++) {
			this.addChild(new Text(this.content[i], 0, 0))
		}

		// Show truncation indicator
		if (hasMore) {
			const remaining = this.content.length - linesToShow
			const action = this.expanded ? "collapse" : "expand"
			const hint = theme.fg(
				"muted",
				`... ${remaining} more lines (Ctrl+E to ${action} all)`,
			)
			this.addChild(new Text(hint, 0, 0))
		}
	}
}

/**
 * File viewer with collapsible content
 */
export class CollapsibleFileViewer extends CollapsibleComponent {
	constructor(
		path: string,
		content: string,
		options: Partial<CollapsibleOptions>,
		ui: TUI,
	) {
        let lines = content.split("\n").map((line) => line.trimEnd())

        // Remove "Here's the result of running `cat -n`..." header if present
        if (lines.length > 0 && lines[0]!.includes("Here's the result of running")) {
			lines = lines.slice(1)
		}

		// Strip line numbers from cat -n format: "   123\tcode" -> "code"
		const lineNumberRegex = /^\s*\d+\t/
		const codeLines = lines.map((line) => line.replace(lineNumberRegex, ""))

		// Remove trailing empty lines
		while (codeLines.length > 0 && codeLines[codeLines.length - 1] === "") {
			codeLines.pop()
		}

		// Apply syntax highlighting
		let highlightedLines = codeLines
		try {
			const highlighted = highlight(codeLines.join("\n"), {
				language: getLanguageFromPath(path),
				ignoreIllegals: true,
			})
			highlightedLines = highlighted.split("\n")
		} catch {
			// If highlighting fails, use original content
		}

		const header = `${theme.bold(theme.fg("toolTitle", "📄 view"))} ${theme.fg("accent", path)}`

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

/** Map file extensions to highlight.js language names */
function getLanguageFromPath(path: string): string | undefined {
	const ext = path.split(".").pop()?.toLowerCase()
	const langMap: Record<string, string> = {
		ts: "typescript",
		tsx: "typescript",
		js: "javascript",
		jsx: "javascript",
		mjs: "javascript",
		cjs: "javascript",
		json: "json",
		md: "markdown",
		py: "python",
		rb: "ruby",
		rs: "rust",
		go: "go",
		java: "java",
		kt: "kotlin",
		swift: "swift",
		c: "c",
		cpp: "cpp",
		h: "c",
		hpp: "cpp",
		cs: "csharp",
		php: "php",
		sh: "bash",
		bash: "bash",
		zsh: "bash",
		fish: "bash",
		yml: "yaml",
		yaml: "yaml",
		toml: "ini",
		ini: "ini",
		xml: "xml",
		html: "html",
		htm: "html",
		css: "css",
		scss: "scss",
		sass: "scss",
		less: "less",
		sql: "sql",
		graphql: "graphql",
		gql: "graphql",
		dockerfile: "dockerfile",
		makefile: "makefile",
		cmake: "cmake",
		vue: "vue",
		svelte: "xml",
	}
	return ext ? langMap[ext] : undefined
}

/**
 * Diff viewer with collapsible hunks
 */
export class CollapsibleDiffViewer extends CollapsibleComponent {
	private oldContent: string
	private newContent: string

	constructor(
		path: string,
		oldContent: string,
		newContent: string,
		options: Partial<CollapsibleOptions>,
		ui: TUI,
	) {
		const header = `${theme.bold(theme.fg("toolTitle", "✏️ edit"))} ${theme.fg("accent", path)}`

		super(
			{
				header,
				collapsedLines: 15,
				expandedLines: 100,
				showLineCount: false,
				...options,
			},
			ui,
		)

		this.oldContent = oldContent
		this.newContent = newContent
		this.generateDiff()
	}

	private generateDiff(): void {
		const oldLines = this.oldContent.split("\n")
		const newLines = this.newContent.split("\n")
		const diff: string[] = []

		// Simple line-by-line diff (in production, use a proper diff algorithm)
		const maxLines = Math.max(oldLines.length, newLines.length)
		let addedCount = 0
		let removedCount = 0

		for (let i = 0; i < maxLines; i++) {
			if (i >= oldLines.length) {
				diff.push(theme.fg("success", `+ ${newLines[i]}`))
				addedCount++
			} else if (i >= newLines.length) {
				diff.push(theme.fg("error", `- ${oldLines[i]}`))
				removedCount++
			} else if (oldLines[i] !== newLines[i]) {
				diff.push(theme.fg("error", `- ${oldLines[i]}`))
				diff.push(theme.fg("success", `+ ${newLines[i]}`))
				addedCount++
				removedCount++
			} else {
				// Context line
				diff.push(theme.fg("muted", `  ${oldLines[i]}`))
			}
		}

		this.summary = `+${addedCount} -${removedCount} lines changed`
		this.setContent(diff)
	}
}

/**
 * Command output viewer with collapsible sections
 */
export class CollapsibleCommandOutput extends CollapsibleComponent {
	constructor(
		command: string,
		output: string,
		exitCode: number,
		options: Partial<CollapsibleOptions>,
		ui: TUI,
	) {
		const status =
			exitCode === 0
				? theme.fg("success", "✓")
				: theme.fg("error", `✗ (exit ${exitCode})`)

		const header = `${theme.bold(theme.fg("toolTitle", "command"))} ${theme.fg("accent", command)} ${status}`

		// Clean up output
		const lines = output.split("\n").map((line) => line.trimEnd())
		while (lines.length > 0 && lines[lines.length - 1] === "") {
			lines.pop()
		}

		super(
			{
				header,
				collapsedLines: exitCode === 0 ? 10 : 50, // Show more on error
				expandedLines: 500,
				showLineCount: true,
				...options,
			},
			ui,
		)

		this.setContent(lines)
	}
}
