/**
 * Write tool — create new files or overwrite existing ones.
 */
import * as fs from "node:fs"
import * as path from "node:path"

import { createTool } from "@mastra/core/tools"
import { z } from "zod/v3"
import { assertPathAllowed, getAllowedPathsFromContext } from "./utils.js"

/**
 * Create the write_file tool for creating/overwriting files.
 */
export function createWriteFileTool(projectRoot?: string) {
	return createTool({
		id: "write_file",
		description: `Create a new file or overwrite an existing file with the given content.

Usage notes:
- Use this to create NEW files. For editing existing files, prefer string_replace_lsp.
- If the file already exists, this tool will overwrite it. You MUST have read the file with view first before overwriting.
- Parent directories will be created automatically if they don't exist.
- The path is relative to the project root directory.
- NEVER create files unless absolutely necessary. Prefer editing existing files.
- Do not create documentation files (README, *.md) unless the user explicitly asks.`,
		// requireApproval: true,
		inputSchema: z.object({
			path: z
				.string()
				.describe("File path to write to (relative to project root)"),
			content: z.string().describe("The full content to write to the file"),
		}),
		execute: async (context, toolContext) => {
			try {
				const root = projectRoot || process.cwd()
				const filePath = context.path
				const absolutePath = path.resolve(root, filePath)
				const allowedPaths = getAllowedPathsFromContext(toolContext)

				// Security: ensure the path is within the project root or allowed paths
				assertPathAllowed(absolutePath, root, allowedPaths)

				// Check if file exists
				const exists = fs.existsSync(absolutePath)

				// Create parent directories if needed
				const dir = path.dirname(absolutePath)
				if (!fs.existsSync(dir)) {
					fs.mkdirSync(dir, { recursive: true })
				}

				// Write the file
				fs.writeFileSync(absolutePath, context.content, "utf-8")

				const lineCount = context.content.split("\n").length
				const relPath = path.relative(root, absolutePath)

				if (exists) {
					return {
						content: `Overwrote ${relPath} (${lineCount} lines)`,
						isError: false,
					}
				} else {
					return {
						content: `Created ${relPath} (${lineCount} lines)`,
						isError: false,
					}
				}
			} catch (error) {
				const msg = error instanceof Error ? error.message : "Unknown error"
				return {
					content: `write_file failed: ${msg}`,
					isError: true,
				}
			}
		},
	})
}
