/**
 * Path security helpers for tools that operate on the local filesystem.
 * These guard against path traversal outside the project root.
 */
import * as path from "node:path"

export function isPathAllowed(
    targetPath: string,
    projectRoot: string,
    allowedPaths: string[] = [],
): boolean {
    const resolved = path.resolve(targetPath)
    const roots = [projectRoot, ...allowedPaths].map((p) => path.resolve(p))
    return roots.some(
        (root) => resolved === root || resolved.startsWith(root + path.sep),
    )
}

export function assertPathAllowed(
    targetPath: string,
    projectRoot: string,
    allowedPaths: string[] = [],
): void {
    if (!isPathAllowed(targetPath, projectRoot, allowedPaths)) {
        const resolvedTarget = path.resolve(targetPath)
        const resolvedRoot = path.resolve(projectRoot)
        throw new Error(
            `Access denied: "${resolvedTarget}" is outside the project root "${resolvedRoot}"` +
            (allowedPaths.length
                ? ` and allowed paths [${allowedPaths.join(", ")}]`
                : "") +
            `. Use /sandbox to add additional allowed paths.`,
        )
    }
}

/**
 * Read sandboxAllowedPaths from the harness request context.
 * Returns an empty array when unavailable (e.g. in tests).
 */
export function getAllowedPathsFromContext(
    toolContext:
        | { requestContext?: { get: (key: string) => unknown } }
        | undefined,
): string[] {
    if (!toolContext?.requestContext) return []
    const harnessCtx = toolContext.requestContext.get("harness") as
        | {
            state?: { sandboxAllowedPaths?: string[] }
            getState?: () => { sandboxAllowedPaths?: string[] }
        }
        | undefined
    return (
        harnessCtx?.getState?.()?.sandboxAllowedPaths ??
        harnessCtx?.state?.sandboxAllowedPaths ??
        []
    )
}
