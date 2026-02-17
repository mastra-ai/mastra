/**
 * request_sandbox_access tool — requests permission to access a directory
 * outside the project root. The user can approve or deny the request via
 * TUI dialog.
 *
 * Adapted for the monorepo: uses deps-based pattern for emitEvent,
 * registerQuestion, getState, and setState instead of reading from
 * HarnessRuntimeContext.
 */
import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import * as path from "node:path"
import { isPathAllowed, getAllowedPathsFromContext } from "./security"
import type { HarnessEvent } from "@mastra/core/harness"

export interface SandboxAccessDeps {
    emitEvent: (event: HarnessEvent) => void
    registerQuestion: (questionId: string, resolve: (answer: string) => void) => void
    getState: () => Record<string, unknown>
    setState: (updates: Record<string, unknown>) => void
}

let requestCounter = 0

export function createRequestSandboxAccessTool(deps: SandboxAccessDeps) {
    return createTool({
        id: "request_sandbox_access",
        description: `Request permission to access a directory outside the current project. Use this when you need to read or write files in a directory that is not within the project root. The user will be prompted to approve or deny the request.`,
        inputSchema: z.object({
            path: z
                .string()
                .min(1)
                .describe(
                    "The absolute path to the directory you need access to.",
                ),
            reason: z
                .string()
                .min(1)
                .describe(
                    "Brief explanation of why you need access to this directory.",
                ),
        }),
        execute: async ({
            path: requestedPath,
            reason,
        }) => {
            try {
                const absolutePath = path.isAbsolute(requestedPath)
                    ? requestedPath
                    : path.resolve(process.cwd(), requestedPath)

                const projectRoot = process.cwd()
                const state = deps.getState()
                const allowedPaths =
                    (state.sandboxAllowedPaths as string[]) ?? []

                if (isPathAllowed(absolutePath, projectRoot, allowedPaths)) {
                    return {
                        content: `Access already granted: "${absolutePath}" is within the project root or allowed paths.`,
                        isError: false,
                    }
                }

                const questionId = `sandbox_${++requestCounter}_${Date.now()}`

                const answer = await new Promise<string>((resolve) => {
                    deps.registerQuestion(questionId, resolve)

                    deps.emitEvent({
                        type: "sandbox_access_request",
                        questionId,
                        path: absolutePath,
                        reason,
                    })
                })

                const approved =
                    answer.toLowerCase().startsWith("y") ||
                    answer.toLowerCase() === "approve"

                if (approved) {
                    const currentAllowed =
                        (deps.getState().sandboxAllowedPaths as string[]) ?? []
                    if (!currentAllowed.includes(absolutePath)) {
                        deps.setState({
                            sandboxAllowedPaths: [
                                ...currentAllowed,
                                absolutePath,
                            ],
                        })
                    }
                    return {
                        content: `Access granted: "${absolutePath}" has been added to allowed paths. You can now access files in this directory.`,
                        isError: false,
                    }
                } else {
                    return {
                        content: `Access denied: The user declined access to "${absolutePath}".`,
                        isError: false,
                    }
                }
            } catch (error) {
                const msg =
                    error instanceof Error ? error.message : "Unknown error"
                return {
                    content: `Failed to request sandbox access: ${msg}`,
                    isError: true,
                }
            }
        },
    })
}
