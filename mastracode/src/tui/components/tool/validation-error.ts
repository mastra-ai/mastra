import { Container, Text, type TUI } from "@mariozechner/pi-tui"
import { theme } from "../../theme"

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
}

export function parseValidationErrors(error: unknown): ValidationError[] {
    const errors: ValidationError[] = []
    if (typeof error === "string") {
        const zodMatch = error.match(/at "([^"]+)".*?: (.+?)(?:\n|$)/g)
        if (zodMatch) {
            zodMatch.forEach((match) => {
                const parts = match.match(/at "([^"]+)".*?: (.+?)(?:\n|$)/)
                if (parts?.[1] && parts[2]) {
                    errors.push({ field: parts[1], message: parts[2] })
                }
            })
        }
        if (errors.length === 0) {
            errors.push({ field: "unknown", message: error })
        }
    } else if (typeof error === "object" && error) {
        const obj = error as { issues?: Array<{ path?: unknown[]; message?: string }> }
        if (Array.isArray(obj.issues)) {
            for (const issue of obj.issues) {
                errors.push({
                    field: Array.isArray(issue.path) ? issue.path.join(".") : "unknown",
                    message: issue.message || "Validation issue",
                })
            }
        }
    }
    return errors.length > 0 ? errors : [{ field: "unknown", message: String(error) }]
}

export class ToolValidationErrorComponent extends Container {
    constructor(options: ToolValidationErrorOptions, _ui?: TUI) {
        super()
        this.addChild(
            new Text(
                `${theme.fg("error", "✗ Tool validation failed: ")}${theme.bold(theme.fg("toolTitle", options.toolName))}`,
                0,
                0,
            ),
        )
        this.addChild(new Text("", 0, 0))
        for (const error of options.errors) {
            this.addChild(
                new Text(
                    `${theme.fg("muted", "  Parameter: ")}${theme.fg("accent", error.field)}`,
                    0,
                    0,
                ),
            )
            this.addChild(
                new Text(
                    `${theme.fg("muted", "  Issue: ")}${theme.fg("error", error.message)}`,
                    0,
                    0,
                ),
            )
        }
    }
}

