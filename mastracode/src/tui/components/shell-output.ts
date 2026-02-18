/**
 * Component that renders shell command output in the chat view.
 */

import { Container, Spacer, Text } from "@mariozechner/pi-tui"
import { fg, bold } from "../theme.js"

export class ShellOutputComponent extends Container {
	constructor(
		command: string,
		stdout: string,
		stderr: string,
		exitCode: number,
	) {
		super()
		this.addChild(new Spacer(1))

		// Command header
		const statusIcon = exitCode === 0 ? "✓" : "✗"
		const statusColor = exitCode === 0 ? "success" : "error"
		this.addChild(
			new Text(
				`${fg(statusColor, statusIcon)} ${bold(fg("muted", "$"))} ${fg("text", command)}`,
				1,
				0,
			),
		)

		// Output
		const output = (
			stdout + (stderr ? (stdout ? "\n" : "") + stderr : "")
		).trimEnd()
		if (output) {
			// Indent each line by 2 spaces
			const lines = output.split("\n")
			for (const line of lines) {
				this.addChild(new Text(fg("toolOutput", `  ${line}`), 0, 0))
			}
		}

		// Show exit code if non-zero
		if (exitCode !== 0) {
			this.addChild(new Text(fg("error", `  Exit code: ${exitCode}`), 0, 0))
		}
	}
}
