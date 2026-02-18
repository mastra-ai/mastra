import { exec } from "child_process"
import { promisify } from "util"
import * as path from "path"
import { homedir } from "os"
import { createTool } from "@mastra/core/tools"
import { z } from "zod/v3"
import { truncateStringForTokenEstimate } from "../utils/token-estimator"
import {
	assertPathAllowed,
	getAllowedPathsFromContext,
	isDirectory,
	makeOutput,
	readFile,
	validatePath,
} from "./utils.js"

const execAsync = promisify(exec)

// Maximum tokens for view tool output
const MAX_VIEW_TOKENS = 3_000

/**
 * Shorten an absolute path for display to save tokens
 * Priority: relative to cwd > ~/path > absolute
 */
function shortenPath(absolutePath: string, cwd: string): string {
	// If path is under cwd, make it relative
	if (absolutePath.startsWith(cwd + "/")) {
		return absolutePath.slice(cwd.length + 1)
	}
	if (absolutePath === cwd) {
		return "."
	}

	// If path is under home, use ~/
	const home = homedir()
	if (absolutePath.startsWith(home + "/")) {
		return "~" + absolutePath.slice(home.length)
	}
	if (absolutePath === home) {
		return "~"
	}

	// Otherwise return as-is
	return absolutePath
}

/**
 * Create the view tool for viewing file contents or directory listings
 */

const viewInputSchema = z.object({
	path: z
		.string()
		.describe("Path to the file or directory (relative to project root)"),
	view_range: z
		.array(z.number())
		.length(2)
		.optional()
		.describe("Optional range of lines to view [start, end]")
});

export function createViewTool(projectRoot?: string) {
	return createTool({
		id: "view",
		description: `Read file contents with line numbers, or list directory contents. Paths are relative to the project root.

Usage notes:
- Use this to read files BEFORE editing them. Never modify code you haven't read.
- Use view_range for large files to read specific line ranges (e.g., [1, 50] for first 50 lines).
- For directories, shows files up to 2 levels deep (excluding hidden files).
- Output includes line numbers (like cat -n) for easy reference.
- When NOT to use this tool: for searching file contents (use grep), for finding files by name (use glob).
- Output is truncated if the file is very large. Use view_range to see specific sections.`,
		inputSchema: viewInputSchema,
		execute: async (input) => {
			try {
				const { path: filePath, view_range } = input

				// Handle directory listing
				if (await isDirectory(absolutePath)) {
					if (view_range) {
						throw new Error(
							"The `view_range` parameter is not allowed when `path` points to a directory.",
						)
					}

					const { stdout, stderr } = await execAsync(
						`find "${absolutePath}" -maxdepth 2 -not -path '*/\\.*'`,
					)

					if (stderr) {
						throw new Error(stderr)
					}

					// Shorten paths in output to save tokens
					const cwd = projectRoot || process.cwd()
					const shortenedPaths = stdout
						.split("\n")
						.map((line) => (line.trim() ? shortenPath(line.trim(), cwd) : ""))
						.join("\n")

					const displayPath = shortenPath(absolutePath, cwd)
					const dirOutput = `Here's the files and directories up to 2 levels deep in ${displayPath}, excluding hidden items:\n${shortenedPaths}\n`
					return {
						content: truncateStringForTokenEstimate(
							dirOutput,
							MAX_VIEW_TOKENS,
							false,
						),
						isError: false,
					}
				}

				// Handle file viewing
				const fileContent = await readFile(absolutePath)

				if (view_range) {
					const fileLines = fileContent.split("\n")
					const nLinesFile = fileLines.length
					let [start, end] = view_range

					// Validate start line
					if (start < 1 || start > nLinesFile) {
						throw new Error(
							`Invalid \`view_range\`: ${view_range}. Its first element \`${start}\` should be within the range of lines of the file: [1, ${nLinesFile}]`,
						)
					}

					// Handle end line
					if (end !== -1) {
						if (end > nLinesFile) {
							end = nLinesFile
						}
						if (end < start) {
							throw new Error(
								`Invalid \`view_range\`: ${view_range}. Its second element \`${end}\` should be larger or equal than its first \`${start}\``,
							)
						}
					}

					// Extract selected lines
					const selectedLines =
						end === -1
							? fileLines.slice(start - 1)
							: fileLines.slice(start - 1, end)

					const output = makeOutput(
						selectedLines.join("\n"),
						String(filePath),
						start,
					)
					return {
						// Truncate from end (keep the start of the range the user requested)
						content: truncateStringForTokenEstimate(
							output,
							MAX_VIEW_TOKENS,
							false,
						),
						isError: false,
					}
				}

				const fileLines = fileContent.split("\n")
				const output = makeOutput(fileContent, String(filePath))
				const truncated = truncateStringForTokenEstimate(
					output,
					MAX_VIEW_TOKENS,
					false,
				)
				const wasTruncated = truncated !== output
				return {
					content: wasTruncated
						? truncated +
						`\n\n... ${fileLines.length} total lines in file. Use view_range to see specific sections.`
						: truncated,
					isError: false,
				}
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : "Unknown error occurred"
				return {
					content: errorMessage,
					isError: true,
				}
			}
		},
	})
}
