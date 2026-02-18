import * as path from "node:path"

import { createTool } from "@mastra/core/tools"
import { execa, ExecaError } from "execa"
import stripAnsi from "strip-ansi"
import treeKill from "tree-kill"
import { z } from "zod/v3"

import { ipcReporter } from "../ipc/ipc-reporter.js"
import { truncateStringForTokenEstimate } from "../utils/token-estimator"
import { isPathAllowed, getAllowedPathsFromContext } from "./utils.js"


// Global registry for pending terminal IDs (keyed by confirmationId)
const pendingTerminalIds = new Map<string, string>()

export function setPendingTerminalId(
	confirmationId: string,
	terminalId: string,
) {
	pendingTerminalIds.set(confirmationId, terminalId)
}

export function getPendingTerminalId(
	confirmationId: string,
): string | undefined {
	return pendingTerminalIds.get(confirmationId)
}

export function clearPendingTerminalId(confirmationId: string) {
	pendingTerminalIds.delete(confirmationId)
}

// Track active subprocesses to clean up on exit
const activeSubprocesses = new Set<number>()
let cleanupHandlersRegistered = false

// Register global cleanup handlers to kill all active subprocesses on exit
function registerCleanupHandlers() {
	if (cleanupHandlersRegistered) return
	cleanupHandlersRegistered = true

	const killAllSubprocesses = () => {
		for (const pid of activeSubprocesses) {
			try {
				// Kill the entire process group
				process.kill(-pid, "SIGKILL")
			} catch {
				// Process may already be dead
			}

			// Also use tree-kill for nested children
			treeKill(pid, "SIGKILL", () => {
				// Ignore errors
			})
		}
		activeSubprocesses.clear()
	}

	// Handle normal exit
	process.on("exit", () => {
		killAllSubprocesses()
	})

	// Handle SIGINT (Ctrl+C)
	process.on("SIGINT", () => {
		killAllSubprocesses()
		process.exit(0)
	})

	// Handle SIGTERM
	process.on("SIGTERM", () => {
		killAllSubprocesses()
		process.exit(0)
	})
}

// Helper to apply tail to output
function applyTail(output: string, tailLines?: number): string {
	if (!tailLines || tailLines <= 0) return output
	const lines = output.split("\n")
	if (lines.length <= tailLines) return output
	return lines.slice(-tailLines).join("\n")
}

// Schema for command execution - matching MCP reference exactly
const ExecuteCommandSchema = z.object({
	command: z.string().describe("Full shell command to execute"),
	cwd: z
		.string()
		.optional()
		.describe("Working directory for command execution"),
	timeout: z
		.number()
		.optional()
		.describe(
			"The number of seconds until the shell command should be killed if it hasn't exited yet. Defaults to 30 seconds",
		),
})

// Function to create the execute command tool with optional project root
export function createExecuteCommandTool(projectRoot?: string) {
	return createTool({
		id: "execute_command",
		description: `Execute a shell command in the local system.

Usage notes:
- Use for: git commands, npm/pnpm, docker, build tools, test runners, linters, and other terminal operations.
- Do NOT use for: reading files (use view tool), searching file contents (use grep tool), finding files (use glob tool), editing files (use string_replace_lsp tool).
- Commands run with a 30-second default timeout. Use the timeout parameter for longer commands.
- Output is stripped of ANSI codes and truncated if too long. Pipe to "| tail -N" for long outputs.
- Be careful with destructive commands. Never run git push --force, git reset --hard, or rm -rf without explicit user request.
- For interactive commands that need user input, they will fail. Set CI=true is already forced.`,
		inputSchema: ExecuteCommandSchema,
		// requireApproval: true,
		execute: async (context, toolContext) => {
			let { command } = context
			let extractedTail: number | undefined

			// Extract `| tail -N` or `| tail -n N` from command if present
			// This allows streaming all output to user while only returning last N lines to agent
			const tailPipeMatch = command.match(/\|\s*tail\s+(?:-n\s+)?(-?\d+)\s*$/)
			if (tailPipeMatch) {
				const tailLines = Math.abs(parseInt(tailPipeMatch[1], 10))
				if (tailLines > 0) {
					extractedTail = tailLines
					// Remove the tail pipe from the command
					command = command
						.replace(/\|\s*tail\s+(?:-n\s+)?-?\d+\s*$/, "")
						.trim()
				}
			}

			// Use provided cwd, fall back to project root, then process.cwd()
			const cwd = context.cwd || projectRoot || process.cwd()
			const root = projectRoot || process.cwd()

			// Security: if a custom cwd was provided, ensure it's within the project root or allowed paths
			if (context.cwd) {
				const allowedPaths = getAllowedPathsFromContext(toolContext)
				const resolvedCwd = path.resolve(context.cwd)
				if (!isPathAllowed(resolvedCwd, root, allowedPaths)) {
					return {
						content: [
							{
								type: "text" as const,
								text: `Error: cwd "${resolvedCwd}" is outside the project root "${root}". Use /sandbox to add additional allowed paths.`,
							},
						],
						isError: true,
					}
				}
			}

			if (!command.includes(cwd) && cwd !== process.cwd()) {
				ipcReporter.send(`shell-output`, {
					output: `\n# ${cwd}`,
					type: `stdout`,
					style: { fg: "grey" },
				})
			}
			ipcReporter.send(`shell-output`, {
				output: `\n\n$ ${command}\n\n`,
				type: `stdout`,
				style: { fg: "green" },
			})

			// Check if we're in ACP mode - stream output via tool_call_update notifications
			const isACPMode = process.argv.includes("--acp-internal")
			if (isACPMode) {
				const { getGlobalConfirmationId } =
					await import("./wrap-with-confirmation.js")

				const _confirmationId = getGlobalConfirmationId()

				try {
					// Use execa to run the command with streaming
					const { execa } = await import("execa")

					let stdout = ""
					let stderr = ""
					let combined = ""

					const timeout = context.timeout ? context.timeout * 1000 : 30000
					const subprocess = execa(command, [], {
						shell: true,
						cwd,
						all: true,
						buffer: true,
						reject: false,
						timeout,
					})

					// Stream stdout chunks
					if (subprocess.stdout) {
						subprocess.stdout.on("data", (chunk: Buffer) => {
							const text = chunk.toString()
							ipcReporter.send(`shell-output`, { output: text, type: `stdout` })
							stdout += text
							combined += text
						})
					}

					// Stream stderr chunks
					if (subprocess.stderr) {
						subprocess.stderr.on("data", (chunk: Buffer) => {
							const text = chunk.toString()
							ipcReporter.send(`shell-output`, { output: text, type: `stderr` })

							stderr += text
							combined += text
						})
					}

					// Wait for completion
					const result = await subprocess

					if (result.timedOut || (result?.exitCode && result.exitCode > 0)) {
						ipcReporter.send(`shell-output`, {
							output: `\nExited with code ${result.exitCode}${result.timedOut ? `\nTimed out after ${timeout}ms` : ``}\n\n`,
							type: "stdout",
							style: { fg: "grey" },
						})
					}

					return {
						stdout: extractedTail ? applyTail(stdout, extractedTail) : stdout,
						stderr: extractedTail ? applyTail(stderr, extractedTail) : stderr,
						combined: extractedTail
							? applyTail(combined, extractedTail)
							: combined,
						exitCode: result.exitCode || 0,
						signal: result.signal,
						timedOut: result.timedOut || false,
						command,
						cwd,
						duration: 0, // execa doesn't provide duration
					}
				} catch (error) {
					throw new Error(
						`Command execution failed: ${error instanceof Error ? error.message : String(error)}`,
					)
				}
			}

			// console.log(`\n🔧 Executing: ${command}`)
			// console.log(`📁 Working directory: ${cwd}`)
			// if (projectRoot && !context.cwd) {
			//   console.log(`   (using project root from frontmatter)`)
			// }
			// console.log('----------------------------------------')
			const timeoutMS = context.timeout ? context.timeout * 1000 : 30_000
			// console.log({ timeoutMS })

			let timeoutHandle: NodeJS.Timeout | undefined
			let manuallyKilled = false
			let abortedBySignal = false
			let subprocess: ReturnType<typeof execa> | undefined
			let capturedOutput = "" // Track output ourselves for abort case

			// Get abort signal and emit function from harness context
			const harnessCtx = (toolContext as any)?.requestContext?.get("harness")
			const abortSignal = harnessCtx?.abortSignal as AbortSignal | undefined
			const emitEvent = harnessCtx?.emitEvent as
				| ((event: {
					type: "shell_output"
					toolCallId: string
					output: string
					stream: "stdout" | "stderr"
				}) => void)
				| undefined
			const toolCallId = (toolContext as any)?.agent?.toolCallId as
				| string
				| undefined

			// Define abort handler outside try block so it's accessible in catch
			const abortHandler = () => {
				if (subprocess?.pid) {
					abortedBySignal = true
					try {
						process.kill(-subprocess.pid, "SIGKILL")
					} catch {
						treeKill(subprocess.pid, "SIGKILL", () => { })
					}
				}
			}

			try {
				// Create the subprocess with environment variables to force color output
				// and use inherit for stdio to preserve TTY context
				subprocess = execa(command, {
					cwd,
					shell: true,
					stdio: ["pipe", "pipe", "pipe"], // all piped — TUI owns the terminal
					buffer: true, // Buffer output for return value
					all: true, // Combine stdout and stderr
					env: {
						// PATH: process.env.PATH,
						...process.env,
						FORCE_COLOR: "1", // Force color output for most Node.js tools
						CLICOLOR_FORCE: "1", // Force color for BSD tools
						TERM: process.env.TERM || "xterm-256color", // Ensure TERM is set
						CI: "true", // Prevent interactive prompts
						NONINTERACTIVE: "1", // Alternative for some tools
						DEBIAN_FRONTEND: "noninteractive", // For apt-get and similar
					},
					// Tell execa to handle the output as if it's a TTY
					stripFinalNewline: false,
					timeout: timeoutMS,
					forceKillAfterDelay: 100,
					killSignal: "SIGKILL",
					cleanup: true,
					detached: true, // Create a new process group so we can kill all children
				})

				// console.log(`shell pid ${subprocess.pid}`)

				// Register cleanup handlers and track this subprocess
				registerCleanupHandlers()
				if (subprocess.pid) {
					activeSubprocesses.add(subprocess.pid)
				}

				// Set up a timeout handler to kill the process tree
				if (timeoutMS && subprocess.pid) {
					timeoutHandle = setTimeout(() => {
						if (subprocess?.pid) {
							// console.error(`\n⏱️  Timeout reached, killing process group ${subprocess.pid}...`)
							manuallyKilled = true
							try {
								// Kill the entire process group by using negative PID
								// This works because we set detached: true
								process.kill(-subprocess.pid, "SIGKILL")
							} catch {
								// console.error(`Failed to kill process group`)
								// Fallback to tree-kill
								treeKill(subprocess.pid, "SIGKILL")
							}
						}
					}, timeoutMS - 100) // Kill 100ms before execa's timeout
				}

				// Set up abort signal handler to kill subprocess on Ctrl+C
				if (abortSignal) {
					abortSignal.addEventListener("abort", abortHandler)
				}
				// Capture stdout/stderr and stream to TUI via harness events
				if (subprocess.stdout) {
					subprocess.stdout.on(`data`, (chunk: Buffer) => {
						const text = chunk.toString()
						capturedOutput += text
						ipcReporter.send(`shell-output`, { output: text, type: `stdout` })
						// Emit shell_output event for TUI streaming
						if (emitEvent && toolCallId) {
							emitEvent({
								type: "shell_output",
								toolCallId,
								output: text,
								stream: "stdout",
							})
						}
					})
				}

				if (subprocess.stderr) {
					subprocess.stderr.on(`data`, (chunk: Buffer) => {
						const text = chunk.toString()
						capturedOutput += text
						ipcReporter.send(`shell-output`, { output: text, type: `stderr` })
						// Emit shell_output event for TUI streaming
						if (emitEvent && toolCallId) {
							emitEvent({
								type: "shell_output",
								toolCallId,
								output: text,
								stream: "stderr",
							})
						}
					})
				}

				// Wait for completion
				const result = await subprocess

				// Clean up abort listener
				if (abortSignal) {
					abortSignal.removeEventListener("abort", abortHandler)
				}

				// Check if aborted
				if (abortedBySignal) {
					ipcReporter.send(`shell-output`, {
						output: `\nAborted by user\n`,
						style: { fg: "yellow" },
						type: "stdout",
					})

					// Clear the timeout
					if (timeoutHandle) {
						clearTimeout(timeoutHandle)
					}

					// Use our captured output (more reliable than result.all on SIGKILL)
					let cleanOutput = stripAnsi(capturedOutput)
					if (extractedTail) {
						cleanOutput = applyTail(cleanOutput, extractedTail)
					}

					return {
						content: [
							{
								type: "text" as const,
								text: cleanOutput.trim()
									? `[User aborted command]\n\nPartial output:\n${truncateStringForTokenEstimate(cleanOutput, 1_000)}`
									: "[User aborted command]",
							},
						],
						isError: true,
					}
				}

				ipcReporter.send(`shell-output`, {
					output: `\nExited with code ${result.exitCode}${result.timedOut ? `\nTimed out after ${timeoutMS}ms` : ``}\n`,
					style: { fg: "grey" },
					type: "stdout",
				})

				// Clear the timeout if command completed successfully
				if (timeoutHandle) {
					clearTimeout(timeoutHandle)
				}

				// console.log('\n✅ Command completed successfully')
				// console.log('----------------------------------------\n')

				// Strip ANSI codes from the output for the LLM
				// Since we have all: true, result.all contains the interleaved output
				const rawOutput =
					result.all ||
					result.stdout ||
					result.stderr ||
					"Command executed successfully with no output"
				let cleanOutput = stripAnsi(
					typeof rawOutput === "string" ? rawOutput : rawOutput.toString(),
				)

				// Apply tail if specified
				if (extractedTail) {
					cleanOutput = applyTail(cleanOutput, extractedTail)
				}

				return {
					content: [
						{
							type: "text",
							// only allow xk tokens of output
							text: truncateStringForTokenEstimate(cleanOutput, 2_000),
						},
					],
					isError: false,
				}
			} catch (error: any) {
				// console.error('\n❌ Command failed')
				// console.error('----------------------------------------\n')
				// Clean up abort listener and timeout handle on error
				if (abortSignal) {
					abortSignal.removeEventListener("abort", abortHandler)
				}
				if (timeoutHandle) {
					clearTimeout(timeoutHandle)
				}

				// Check if aborted by user
				if (abortedBySignal) {
					let cleanOutput = stripAnsi(capturedOutput)
					if (extractedTail) {
						cleanOutput = applyTail(cleanOutput, extractedTail)
					}

					return {
						content: [
							{
								type: "text" as const,
								text: cleanOutput.trim()
									? `[User aborted command]\n\nPartial output:\n${truncateStringForTokenEstimate(cleanOutput, 1_000)}`
									: "[User aborted command]",
							},
						],
						isError: true,
					}
				}

				// Strip ANSI codes from error message for the LLM
				let cleanError = ""

				if (error instanceof ExecaError) {
					const causeMessage = (error.cause as Error)?.message || ""
					const stderr = error.stderr ? stripAnsi(error.stderr) : ""
					const stdout = error.stdout ? stripAnsi(error.stdout) : ""
					const all = error.all ? stripAnsi(error.all) : ""
					const isTimeout = error.timedOut || error.isCanceled || manuallyKilled

					// Combine all error information with clear labels
					const parts = []
					if (isTimeout) {
						parts.push(`Error: command timed out after ${timeoutMS}ms`)
					} else if (causeMessage) {
						parts.push(`Error: ${stripAnsi(causeMessage)}`)
					}

					if (all) {
						parts.push(`Output: ${all}`)
					} else {
						if (stderr) parts.push(`STDERR: ${stderr}`)
						if (stdout) parts.push(`STDOUT: ${stdout}`)
					}

					cleanError = parts.join("\n\n")
				} else {
					// Safely check if error has a message property
					try {
						if (
							error &&
							typeof error === "object" &&
							"message" in error &&
							typeof error.message === "string"
						) {
							cleanError = error.message
						} else {
							cleanError = String(error)
						}
					} catch {
						cleanError = String(error)
					}
				}

				return {
					content: [
						{
							type: "text",
							// only allow xk tokens of output
							text: truncateStringForTokenEstimate(cleanError, 2_000),
						},
					],
					isError: true,
				}
			} finally {
				// console.log(`shell command finally executed`)

				// Remove subprocess from tracking
				if (subprocess && subprocess.pid) {
					activeSubprocesses.delete(subprocess.pid)
				}

				// Always kill any remaining child processes to prevent dangling processes
				// This is especially important for commands with pipes (e.g., npm test | head)
				// where the pipe may terminate early but leave child processes running
				if (subprocess && subprocess.pid) {
					try {
						// First try to kill the process group
						process.kill(-subprocess.pid, "SIGKILL")
					} catch {
						// Process group may already be dead, that's fine
					}

					// Also use tree-kill to ensure all nested children are killed
					// This handles cases where child processes spawn their own children
					// (e.g., npm spawning vitest workers)
					const pid = subprocess?.pid
					if (pid) {
						try {
							await new Promise<void>((resolve) => {
								treeKill(pid, "SIGKILL", (err) => {
									if (err && err.message !== "No such process") {
										// tree-kill error (non-fatal)
									}
									resolve()
								})
							})
						} catch {
							// Ignore errors from tree-kill
						}
					}
				}
			}
		},
	})
}

// Default export for backward compatibility
export const executeCommandTool = createExecuteCommandTool()

export default executeCommandTool
