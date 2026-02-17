/**
 * Shell tool — execute commands with streaming, timeout, and cleanup.
 *
 * Simplified from the original: ACP/IPC dependencies removed,
 * core subprocess management and harness event streaming preserved.
 */
import { z } from "zod"
import { execa, ExecaError } from "execa"
import stripAnsi from "strip-ansi"
import { truncateStringForTokenEstimate } from "../utils/tokens"
import treeKill from "tree-kill"
import { createTool } from "@mastra/core/tools"
import * as path from "node:path"
import { isPathAllowed, getAllowedPathsFromContext } from "./security"

// Track active subprocesses to clean up on exit
const activeSubprocesses = new Set<number>()
let cleanupHandlersRegistered = false

function registerCleanupHandlers() {
    if (cleanupHandlersRegistered) return
    cleanupHandlersRegistered = true

    const killAllSubprocesses = () => {
        for (const pid of activeSubprocesses) {
            try {
                process.kill(-pid, "SIGKILL")
            } catch {
                // Process may already be dead
            }
            treeKill(pid, "SIGKILL", () => { })
        }
        activeSubprocesses.clear()
    }

    process.on("exit", () => killAllSubprocesses())
    process.on("SIGINT", () => {
        killAllSubprocesses()
        process.exit(0)
    })
    process.on("SIGTERM", () => {
        killAllSubprocesses()
        process.exit(0)
    })
}

function applyTail(output: string, tailLines?: number): string {
    if (!tailLines || tailLines <= 0) return output
    const lines = output.split("\n")
    if (lines.length <= tailLines) return output
    return lines.slice(-tailLines).join("\n")
}

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
- For interactive commands that need user input, they will fail. CI=true is already forced.`,
        inputSchema: ExecuteCommandSchema,
        execute: async (context, toolContext) => {
            let { command } = context
            let extractedTail: number | undefined

            // Extract `| tail -N` or `| tail -n N` from command
            const tailPipeMatch = command.match(
                /\|\s*tail\s+(?:-n\s+)?(-?\d+)\s*$/,
            )
            if (tailPipeMatch) {
                const tailLines = Math.abs(parseInt(tailPipeMatch[1], 10))
                if (tailLines > 0) {
                    extractedTail = tailLines
                    command = command
                        .replace(/\|\s*tail\s+(?:-n\s+)?-?\d+\s*$/, "")
                        .trim()
                }
            }

            const cwd = context.cwd || projectRoot || process.cwd()
            const root = projectRoot || process.cwd()

            // Security: if a custom cwd was provided, ensure it's within the project root
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

            const timeoutMS = context.timeout ? context.timeout * 1000 : 30_000

            let timeoutHandle: ReturnType<typeof setTimeout> | undefined
            let manuallyKilled = false
            let abortedBySignal = false
            let subprocess: ReturnType<typeof execa> | undefined
            let capturedOutput = ""

            // Get abort signal and emit function from harness context
            const harnessCtx = (toolContext as any)?.requestContext?.get(
                "harness",
            )
            const abortSignal = harnessCtx?.abortSignal as
                | AbortSignal
                | undefined
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
                subprocess = execa(command, {
                    cwd,
                    shell: true,
                    stdio: ["pipe", "pipe", "pipe"],
                    buffer: true,
                    all: true,
                    env: {
                        ...process.env,
                        FORCE_COLOR: "1",
                        CLICOLOR_FORCE: "1",
                        TERM: process.env.TERM || "xterm-256color",
                        CI: "true",
                        NONINTERACTIVE: "1",
                        DEBIAN_FRONTEND: "noninteractive",
                    },
                    stripFinalNewline: false,
                    timeout: timeoutMS,
                    forceKillAfterDelay: 100,
                    killSignal: "SIGKILL",
                    cleanup: true,
                    detached: true,
                })

                registerCleanupHandlers()
                if (subprocess.pid) {
                    activeSubprocesses.add(subprocess.pid)
                }

                if (timeoutMS && subprocess.pid) {
                    timeoutHandle = setTimeout(() => {
                        if (subprocess?.pid) {
                            manuallyKilled = true
                            try {
                                process.kill(-subprocess.pid, "SIGKILL")
                            } catch {
                                treeKill(subprocess.pid, "SIGKILL")
                            }
                        }
                    }, timeoutMS - 100)
                }

                if (abortSignal) {
                    abortSignal.addEventListener("abort", abortHandler)
                }

                // Capture and stream output
                if (subprocess.stdout) {
                    subprocess.stdout.on("data", (chunk: Buffer) => {
                        const text = chunk.toString()
                        capturedOutput += text
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
                    subprocess.stderr.on("data", (chunk: Buffer) => {
                        const text = chunk.toString()
                        capturedOutput += text
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

                const result = await subprocess

                if (abortSignal) {
                    abortSignal.removeEventListener("abort", abortHandler)
                }

                if (abortedBySignal) {
                    if (timeoutHandle) clearTimeout(timeoutHandle)
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

                if (timeoutHandle) clearTimeout(timeoutHandle)

                const rawOutput =
                    result.all ||
                    result.stdout ||
                    result.stderr ||
                    "Command executed successfully with no output"
                let cleanOutput = stripAnsi(
                    typeof rawOutput === "string"
                        ? rawOutput
                        : rawOutput.toString(),
                )

                if (extractedTail) {
                    cleanOutput = applyTail(cleanOutput, extractedTail)
                }

                return {
                    content: [
                        {
                            type: "text",
                            text: truncateStringForTokenEstimate(
                                cleanOutput,
                                2_000,
                            ),
                        },
                    ],
                    isError: false,
                }
            } catch (error: any) {
                if (abortSignal) {
                    abortSignal.removeEventListener("abort", abortHandler)
                }
                if (timeoutHandle) clearTimeout(timeoutHandle)

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

                let cleanError = ""
                if (error instanceof ExecaError) {
                    const causeMessage =
                        (error.cause as Error)?.message || ""
                    const stderr = error.stderr
                        ? stripAnsi(error.stderr)
                        : ""
                    const stdout = error.stdout
                        ? stripAnsi(error.stdout)
                        : ""
                    const all = error.all ? stripAnsi(error.all) : ""
                    const isTimeout =
                        error.timedOut || error.isCanceled || manuallyKilled

                    const parts = []
                    if (isTimeout) {
                        parts.push(
                            `Error: command timed out after ${timeoutMS}ms`,
                        )
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
                            text: truncateStringForTokenEstimate(
                                cleanError,
                                2_000,
                            ),
                        },
                    ],
                    isError: true,
                }
            } finally {
                if (subprocess?.pid) {
                    activeSubprocesses.delete(subprocess.pid)
                }
                if (subprocess?.pid) {
                    try {
                        process.kill(-subprocess.pid, "SIGKILL")
                    } catch {
                        // Process group may already be dead
                    }
                    const pid = subprocess.pid
                    try {
                        await new Promise<void>((resolve) => {
                            treeKill(pid, "SIGKILL", () => resolve())
                        })
                    } catch {
                        // Ignore
                    }
                }
            }
        },
    })
}

export const executeCommandTool = createExecuteCommandTool()
export default executeCommandTool
