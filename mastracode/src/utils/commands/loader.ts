/**
 * Slash command discovery and loading.
 *
 * Scans project and user directories for markdown-based slash commands.
 * Supports YAML frontmatter for metadata and filesystem-based namespacing.
 */

import { promises as fs } from "node:fs"
import * as path from "node:path"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Frontmatter parsing (no js-yaml dep — simple key:value)
// ---------------------------------------------------------------------------

function parseFrontmatter(raw: string): Record<string, string> {
    const result: Record<string, string> = {}
    for (const line of raw.split("\n")) {
        const sep = line.indexOf(":")
        if (sep > 0) {
            const key = line.slice(0, sep).trim()
            const value = line.slice(sep + 1).trim()
            if (key && value) result[key] = value
        }
    }
    return result
}

// ---------------------------------------------------------------------------
// File parsing
// ---------------------------------------------------------------------------

export async function parseCommandFile(
    filePath: string,
    baseDir?: string,
): Promise<SlashCommandMetadata | null> {
    try {
        const content = await fs.readFile(filePath, "utf-8")
        const trimmedContent = content.trim()

        if (!trimmedContent.startsWith("---")) {
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

        const parts = content.split("---")
        if (parts.length < 3) return null

        const frontmatter = parts[1].trim()
        const template = parts.slice(2).join("---").trim()

        const metadata = parseFrontmatter(frontmatter)

        let name: string
        if (metadata.name) {
            name = metadata.name
        } else if (baseDir) {
            name = extractCommandName(filePath, baseDir)
        } else {
            name = path.basename(filePath, ".md")
        }

        return {
            name,
            description: metadata.description || "",
            template,
            sourcePath: filePath,
            namespace: metadata.namespace,
        }
    } catch {
        return null
    }
}

/**
 * Extract command name from file path.
 * Converts path like `git/commit.md` to `git:commit`.
 */
export function extractCommandName(filePath: string, baseDir: string): string {
    const relativePath = path.relative(baseDir, filePath)
    const dirName = path.dirname(relativePath)
    const baseName = path.basename(relativePath, ".md")

    if (dirName === "." || dirName === "") return baseName

    const namespace = dirName.replace(/[\\/]/g, ":")
    return `${namespace}:${baseName}`
}

// ---------------------------------------------------------------------------
// Directory scanning
// ---------------------------------------------------------------------------

export async function scanCommandDirectory(
    dirPath: string,
): Promise<SlashCommandMetadata[]> {
    const commands: SlashCommandMetadata[] = []

    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true })

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name)

            if (entry.isDirectory()) {
                const subCommands = await scanCommandDirectory(fullPath)
                commands.push(...subCommands)
            } else if (entry.isFile() && entry.name.endsWith(".md")) {
                const command = await parseCommandFile(fullPath, dirPath)
                if (command) commands.push(command)
            }
        }
    } catch {
        // Directory doesn't exist or can't be read — silently skip
    }

    return commands
}

// ---------------------------------------------------------------------------
// Multi-source loading
// ---------------------------------------------------------------------------

/**
 * Load custom slash commands from all configured directories.
 *
 * Priority (lowest to highest):
 *   1. ~/.opencode/command
 *   2. ~/.claude/commands
 *   3. ~/.mastracode/commands
 *   4. <project>/.opencode/command
 *   5. <project>/.claude/commands
 *   6. <project>/.mastracode/commands
 */
export async function loadCustomCommands(
    projectDir?: string,
): Promise<SlashCommandMetadata[]> {
    const commands: SlashCommandMetadata[] = []
    const seenNames = new Set<string>()

    const addCommands = (newCommands: SlashCommandMetadata[]) => {
        for (const cmd of newCommands) {
            if (!seenNames.has(cmd.name)) {
                seenNames.add(cmd.name)
                commands.push(cmd)
            }
        }
    }

    const homeDir = process.env.HOME || process.env.USERPROFILE

    // User-level directories (lowest priority)
    if (homeDir) {
        addCommands(await scanCommandDirectory(path.join(homeDir, ".opencode", "command")))
        addCommands(await scanCommandDirectory(path.join(homeDir, ".claude", "commands")))
        addCommands(await scanCommandDirectory(path.join(homeDir, ".mastracode", "commands")))
    }

    // Project-level directories (highest priority)
    if (projectDir) {
        addCommands(await scanCommandDirectory(path.join(projectDir, ".opencode", "command")))
        addCommands(await scanCommandDirectory(path.join(projectDir, ".claude", "commands")))
        addCommands(await scanCommandDirectory(path.join(projectDir, ".mastracode", "commands")))
    }

    return commands
}

/**
 * Get the commands directory path for a project.
 */
export function getProjectCommandsDir(projectDir: string): string {
    return path.join(projectDir, ".mastracode", "commands")
}

/**
 * Initialize a commands directory with an example command.
 */
export async function initCommandsDirectory(projectDir: string): Promise<void> {
    const commandsDir = getProjectCommandsDir(projectDir)

    try {
        await fs.mkdir(commandsDir, { recursive: true })

        const examplePath = path.join(commandsDir, "example.md")
        const exampleContent = `---
name: example
description: An example slash command
---

This is an example slash command template.
You can use variables like $ARGUMENTS or $1, $2 for positional args.
You can also include file content with @filename.
Shell commands with !\`command\` will be executed and output included.
`

        try {
            await fs.access(examplePath)
        } catch {
            await fs.writeFile(examplePath, exampleContent, "utf-8")
        }
    } catch {
        // Silently ignore initialization errors
    }
}
