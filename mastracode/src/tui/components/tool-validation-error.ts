/**
 * Enhanced display component for tool validation errors.
 * Provides clear, actionable feedback when tool inputs are invalid.
 */

import { Container, Text  } from "@mariozechner/pi-tui"
import type {TUI} from "@mariozechner/pi-tui";
import { theme } from "../theme.js"

export interface ValidationError {
	field: string
	message: string
	expected?: string
	received?: string
}

export interface ToolValidationErrorOptions {
	toolName: string
	errors: ValidationError[]
	args?: unknown
	schema?: unknown
}

/**
 * Parse validation errors from various error formats
 */
export function parseValidationErrors(error: unknown): ValidationError[] {
	const errors: ValidationError[] = []

	if (typeof error === "string") {
		// Try to parse Zod-style errors
		const zodMatch = error.match(/at "([^"]+)".*?: (.+?)(?:\n|$)/g)
		if (zodMatch) {
			zodMatch.forEach((match) => {
				const [, field, message] =
					match.match(/at "([^"]+)".*?: (.+?)(?:\n|$)/) || []
				if (field && message) {
					errors.push({ field, message })
				}
			})
		}

		// Try to parse "missing required parameter" errors
        const missingMatch = error.match(/missing required.*?["`'](\w+)["`']/i)
        if (missingMatch) {
            errors.push({
                field: missingMatch[1]!,
                message: "Required parameter is missing",
            })
        }

		// Generic fallback
		if (errors.length === 0) {
			errors.push({
				field: "unknown",
				message: error,
			})
		}
	} else if (typeof error === "object" && error !== null) {
		// Handle structured error objects
		const err = error as any

		// Zod error format
		if (err.issues && Array.isArray(err.issues)) {
			err.issues.forEach((issue: any) => {
				errors.push({
					field: issue.path?.join(".") || "unknown",
					message: issue.message,
					expected: issue.expected,
					received: issue.received,
				})
			})
		}
		// Generic error with message
		else if (err.message) {
			errors.push({
				field: err.field || "unknown",
				message: err.message,
			})
		}
	}

	return errors.length > 0
		? errors
		: [{ field: "unknown", message: String(error) }]
}

/**
 * Format tool arguments for display
 */
function formatArgs(args: unknown): string[] {
	if (!args || typeof args !== "object") return []

	const lines: string[] = []
	const obj = args as Record<string, unknown>

	for (const [key, value] of Object.entries(obj)) {
		let valueStr: string
		if (value === null || value === undefined) {
			valueStr = theme.fg("muted", "undefined")
		} else if (typeof value === "string") {
			valueStr = value.length > 50 ? `"${value.slice(0, 47)}..."` : `"${value}"`
		} else if (typeof value === "object") {
			valueStr = JSON.stringify(value)
			if (valueStr.length > 50) {
				valueStr = valueStr.slice(0, 47) + "..."
			}
		} else {
			valueStr = String(value)
		}

		lines.push(`  ${theme.fg("accent", key)}: ${valueStr}`)
	}

	return lines
}

/**
 * Enhanced tool validation error display component
 */
export class ToolValidationErrorComponent extends Container {
	constructor(options: ToolValidationErrorOptions, _ui: TUI) {
		super()

		const { toolName, errors, args } = options

		// Header
		this.addChild(
			new Text(
				`${theme.fg("error", "✗ Tool validation failed: ")}${theme.bold(theme.fg("toolTitle", toolName))}`,
				0,
				0,
			),
		)
		this.addChild(new Text("", 0, 0))

		// Error details
		errors.forEach((error, index) => {
			if (index > 0) {
				this.addChild(new Text("", 0, 0))
			}

			if (error.field !== "unknown") {
				this.addChild(
					new Text(
						`${theme.fg("muted", "  Parameter: ")}${theme.fg("accent", error.field)}`,
						0,
						0,
					),
				)
			}

			this.addChild(
				new Text(
					`${theme.fg("muted", "  Issue: ")}${theme.fg("error", error.message)}`,
					0,
					0,
				),
			)

			if (error.expected || error.received) {
				let detail = ""
				if (error.expected) {
					detail += `${theme.fg("muted", "  Expected: ")}${theme.fg("success", error.expected)}`
					if (error.received) detail += theme.fg("muted", ", ")
				}
				if (error.received) {
					detail += `${theme.fg("muted", "Received: ")}${theme.fg("error", error.received)}`
				}
				this.addChild(new Text(detail, 0, 0))
			}
		})

		// Show provided arguments if available
		if (args && Object.keys(args as any).length > 0) {
			this.addChild(new Text("", 0, 0))
			this.addChild(new Text(theme.fg("muted", "Provided arguments:"), 0, 0))
			const argsLines = formatArgs(args)
			argsLines.forEach((line) => {
				this.addChild(new Text(line, 0, 0))
			})
		}

		// Suggestions
		const suggestions = this.generateSuggestions(toolName, errors)
		if (suggestions.length > 0) {
			this.addChild(new Text("", 0, 0))
			this.addChild(
				new Text(theme.bold(theme.fg("accent", "Suggestions:")), 0, 0),
			)
			suggestions.forEach((suggestion) => {
				this.addChild(new Text(`  • ${suggestion}`, 0, 0))
			})
		}
	}

	private generateSuggestions(
		toolName: string,
		errors: ValidationError[],
	): string[] {
		const suggestions: string[] = []

		const missingParams = errors.filter(
			(e) =>
				e.message.toLowerCase().includes("required") ||
				e.message.toLowerCase().includes("missing"),
		)

		if (missingParams.length > 0) {
			const params = missingParams
				.map((e) => e.field)
				.filter((f) => f !== "unknown")
			if (params.length > 0) {
				suggestions.push(
					`Add the required parameter${params.length > 1 ? "s" : ""}: ${params.join(", ")}`,
				)
			}
		}

		const typeErrors = errors.filter(
			(e) =>
				e.message.toLowerCase().includes("type") ||
				e.message.toLowerCase().includes("expected"),
		)

		if (typeErrors.length > 0) {
			suggestions.push("Check that parameter types match the expected format")
		}

		if (toolName === "ask_user" && errors.some((e) => e.field === "question")) {
			suggestions.push(
				'Make sure to provide a "question" parameter with your question text',
			)
		}

		if (
			toolName === "execute_command" &&
			errors.some((e) => e.field === "command")
		) {
			suggestions.push(
				'Provide a "command" parameter with the command to execute',
			)
		}

		if (toolName === "view" && errors.some((e) => e.field === "path")) {
			suggestions.push(
				'Provide a "path" parameter with the file or directory path',
			)
		}

		return suggestions
	}
}
