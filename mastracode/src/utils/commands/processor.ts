/**
 * Slash command execution.
 *
 * Processes a slash command template by replacing:
 *   - $ARGUMENTS / $1, $2, ... — user-supplied arguments
 *   - !`command` — shell command output
 *   - @path/to/file — file contents
 */

import { promises as fs } from "node:fs"
import { execSync } from "node:child_process"
import * as path from "node:path"
import type { SlashCommandMetadata } from "./loader"

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Process a slash command template, expanding all variables.
 */
export async function processSlashCommand(
    command: SlashCommandMetadata,
    args: string[],
    workingDir: string,
): Promise<string> {
    let result = command.template
    result = replaceArguments(result, args)
    result = await replaceShellOutput(result, workingDir)
    result = await replaceFileReferences(result, workingDir)
    return result
}

/**
 * Format a command for display in help/autocomplete.
 */
export function formatCommandForDisplay(command: SlashCommandMetadata): string {
    const parts = [command.name]
    if (command.description) parts.push(`- ${command.description}`)
    return parts.join(" ")
}

/**
 * Group commands by namespace for display.
 */
export function groupCommandsByNamespace(
    commands: SlashCommandMetadata[],
): Map<string, SlashCommandMetadata[]> {
    const groups = new Map<string, SlashCommandMetadata[]>()

    for (const command of commands) {
        const namespace = command.namespace || command.name.split(":")[0] || "general"
        if (!groups.has(namespace)) groups.set(namespace, [])
        groups.get(namespace)!.push(command)
    }

    return groups
}

// ---------------------------------------------------------------------------
// Template expansion helpers
// ---------------------------------------------------------------------------

function replaceArguments(template: string, args: string[]): string {
    let result = template

    result = result.replace(/\$ARGUMENTS/g, args.join(" "))

    args.forEach((arg, index) => {
        const pattern = new RegExp(`\\$${index + 1}`, "g")
        result = result.replace(pattern, arg)
    })

    // Clear unused positional arguments
    result = result.replace(/\$\d+/g, "")

    return result
}

async function replaceShellOutput(template: string, workingDir: string): Promise<string> {
    const shellPattern = /!`([^`]+)`/g
    const matches = [...template.matchAll(shellPattern)]

    let result = template

    for (const match of matches) {
        const [fullMatch, command] = match
        try {
            const output = execSync(command, {
                cwd: workingDir,
                encoding: "utf-8",
                timeout: 30000,
                maxBuffer: 1024 * 1024,
            })
            result = result.replace(fullMatch, output.trim())
        } catch {
            result = result.replace(fullMatch, `[Error: Failed to execute "${command}"]`)
        }
    }

    return result
}

async function replaceFileReferences(template: string, workingDir: string): Promise<string> {
    const filePattern = /@([\w./-]+)/g
    const matches = [...template.matchAll(filePattern)]

    let result = template

    for (const match of matches) {
        const [fullMatch, filePath] = match
        try {
            const fullPath = path.resolve(workingDir, filePath)
            const content = await fs.readFile(fullPath, "utf-8")
            result = result.replace(fullMatch, content)
        } catch {
            result = result.replace(fullMatch, `[Error: Could not read "${filePath}"]`)
        }
    }

    return result
}
