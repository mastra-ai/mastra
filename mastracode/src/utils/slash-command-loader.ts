import { promises as fs } from "node:fs"
import * as path from "node:path"
import * as yaml from "js-yaml"

/**
 * Metadata for a slash command
 */
export interface SlashCommandMetadata {
	/** Command name (e.g., "git:commit") */
	name: string
	/** Human-readable description */
	description: string
	/** The command template with variables */
	template: string
	/** Source file path */
	sourcePath: string
	/** Namespace derived from directory structure */
	namespace?: string
}

/**
 * Parse a command file and extract metadata and template
 * Supports both frontmatter-based and plain markdown files
 */
export async function parseCommandFile(
	filePath: string,
	baseDir?: string,
): Promise<SlashCommandMetadata | null> {
	try {
		const content = await fs.readFile(filePath, "utf-8")
		const trimmedContent = content.trim()

		// Check if file has frontmatter (starts with ---)
		if (!trimmedContent.startsWith("---")) {
			// No frontmatter - treat entire file as template
			// Derive name from file path
			const name = baseDir
				? extractCommandName(filePath, baseDir)
				: path.basename(filePath, ".md")

			return {
				name,
				description: "",
				template: content,
				sourcePath: filePath,
			}
		}

		// Split frontmatter and template
		const parts = content.split("---")
		if (parts.length < 3) {
			return null
		}

		const frontmatter = parts[1].trim()
		const template = parts.slice(2).join("---").trim()

		// Parse YAML frontmatter
		const metadata = yaml.load(frontmatter) as Record<string, string>

		// Derive name from file path if not specified in frontmatter
		let name: string
		if (metadata?.name) {
			name = metadata.name
		} else if (baseDir) {
			name = extractCommandName(filePath, baseDir)
		} else {
			name = path.basename(filePath, ".md")
		}

		return {
			name,
			description: metadata?.description || "",
			template,
			sourcePath: filePath,
			namespace: metadata?.namespace,
		}
	} catch (error) {
		console.error(`Error parsing command file ${filePath}:`, error)
		return null
	}
}

/**
 * Extract command name from file path
 * Converts path like "git/commit.md" to "git:commit"
 */
export function extractCommandName(filePath: string, baseDir: string): string {
	const relativePath = path.relative(baseDir, filePath)
	const dirName = path.dirname(relativePath)
	const baseName = path.basename(relativePath, ".md")

	if (dirName === "." || dirName === "") {
		return baseName
	}

	// Replace path separators with colons for namespacing
	const namespace = dirName.replace(/[\\/]/g, ":")
	return `${namespace}:${baseName}`
}

/**
 * Recursively scan a directory for command files
 */
export async function scanCommandDirectory(
	dirPath: string,
): Promise<SlashCommandMetadata[]> {
	const commands: SlashCommandMetadata[] = []

	try {
		const entries = await fs.readdir(dirPath, { withFileTypes: true })

		for (const entry of entries) {
			const fullPath = path.join(dirPath, entry.name)

			if (entry.isDirectory()) {
				// Recursively scan subdirectories
				const subCommands = await scanCommandDirectory(fullPath)
				commands.push(...subCommands)
			} else if (entry.isFile() && entry.name.endsWith(".md")) {
				// Parse markdown command files, passing dirPath as baseDir for name derivation
				const command = await parseCommandFile(fullPath, dirPath)
				if (command) {
					commands.push(command)
				}
			}
		}
	} catch {
		// Directory doesn't exist or can't be read - silently skip
	}

	return commands
}
/**
 * Load custom slash commands from all configured directories
 * Priority: mastra project > claude project > opencode project > mastra user > claude user > opencode user
 */
export async function loadCustomCommands(
	projectDir?: string,
): Promise<SlashCommandMetadata[]> {
	const commands: SlashCommandMetadata[] = []
	const seenNames = new Set<string>()

	// Helper to add commands without duplicates (later commands override earlier ones)
	const addCommands = (newCommands: SlashCommandMetadata[]) => {
		for (const cmd of newCommands) {
			if (!seenNames.has(cmd.name)) {
				seenNames.add(cmd.name)
				commands.push(cmd)
			}
		}
	}

	const homeDir = process.env.HOME || process.env.USERPROFILE

	// 1. Load from opencode user directory ~/.opencode/command (lowest priority)
	if (homeDir) {
		const opencodeUserDir = path.join(homeDir, ".opencode", "command")
		const opencodeUserCommands = await scanCommandDirectory(opencodeUserDir)
		addCommands(opencodeUserCommands)
	}

	// 2. Load from claude user directory ~/.claude/commands (Claude Code compat)
	if (homeDir) {
		const claudeUserDir = path.join(homeDir, ".claude", "commands")
		const claudeUserCommands = await scanCommandDirectory(claudeUserDir)
		addCommands(claudeUserCommands)
	}

	// 3. Load from mastra user directory ~/.mastracode/commands
	if (homeDir) {
		const mastraUserDir = path.join(homeDir, ".mastracode", "commands")
		const mastraUserCommands = await scanCommandDirectory(mastraUserDir)
		addCommands(mastraUserCommands)
	}

	// 4. Load from opencode project directory .opencode/command
	if (projectDir) {
		const opencodeProjectDir = path.join(projectDir, ".opencode", "command")
		const opencodeProjectCommands =
			await scanCommandDirectory(opencodeProjectDir)
		addCommands(opencodeProjectCommands)
	}

	// 5. Load from claude project directory .claude/commands (Claude Code compat)
	if (projectDir) {
		const claudeProjectDir = path.join(projectDir, ".claude", "commands")
		const claudeProjectCommands = await scanCommandDirectory(claudeProjectDir)
		addCommands(claudeProjectCommands)
	}

	// 6. Load from mastra project directory .mastracode/commands (highest priority)
	if (projectDir) {
		const mastraProjectDir = path.join(projectDir, ".mastracode", "commands")
		const mastraProjectCommands = await scanCommandDirectory(mastraProjectDir)
		addCommands(mastraProjectCommands)
	}

	return commands
}

/**
 * Get the commands directory path for a project
 */
export function getProjectCommandsDir(projectDir: string): string {
	return path.join(projectDir, ".mastracode", "commands")
}

/**
 * Initialize a commands directory with an example command
 */
export async function initCommandsDirectory(projectDir: string): Promise<void> {
	const commandsDir = getProjectCommandsDir(projectDir)

	try {
		await fs.mkdir(commandsDir, { recursive: true })

		// Create an example command
		const examplePath = path.join(commandsDir, "example.md")
		const exampleContent = `---
name: example
description: An example slash command
---

This is an example slash command template.
You can use variables like \$ARGUMENTS or \$1, \$2 for positional args.
You can also include file content with @filename.
Shell commands with !command will be executed and output included.
`

		try {
			await fs.access(examplePath)
			// File already exists, don't overwrite
		} catch {
			await fs.writeFile(examplePath, exampleContent, "utf-8")
		}
	} catch (error) {
		console.error("Error initializing commands directory:", error)
	}
}
