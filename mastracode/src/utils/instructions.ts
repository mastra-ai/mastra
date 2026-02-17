/**
 * Agent instruction loading.
 *
 * Loads project and global agent instruction files (AGENT.md, CLAUDE.md).
 * Prefers AGENT.md over CLAUDE.md when both exist at the same location.
 */

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InstructionSource {
    path: string
    content: string
    scope: "global" | "project"
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const INSTRUCTION_FILES = ["AGENT.md", "CLAUDE.md"]

const PROJECT_LOCATIONS = [
    "", // project root
    ".claude",
    ".mastracode",
]

const GLOBAL_LOCATIONS = [
    ".claude",
    ".mastracode",
    ".config/claude",
    ".config/mastracode",
]

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

function findInstructionFile(basePath: string): string | null {
    for (const filename of INSTRUCTION_FILES) {
        const fullPath = join(basePath, filename)
        if (existsSync(fullPath)) {
            return fullPath
        }
    }
    return null
}

/**
 * Load all agent instruction files from global and project locations.
 * Returns an array of instruction sources, with global ones first.
 */
export function loadAgentInstructions(projectPath: string): InstructionSource[] {
    const sources: InstructionSource[] = []
    const home = homedir()

    for (const location of GLOBAL_LOCATIONS) {
        const basePath = join(home, location)
        const filePath = findInstructionFile(basePath)
        if (filePath) {
            try {
                const content = readFileSync(filePath, "utf-8").trim()
                if (content) {
                    sources.push({ path: filePath, content, scope: "global" })
                    break
                }
            } catch {
                // Skip unreadable files
            }
        }
    }

    for (const location of PROJECT_LOCATIONS) {
        const basePath = location ? join(projectPath, location) : projectPath
        const filePath = findInstructionFile(basePath)
        if (filePath) {
            try {
                const content = readFileSync(filePath, "utf-8").trim()
                if (content) {
                    sources.push({ path: filePath, content, scope: "project" })
                    break
                }
            } catch {
                // Skip unreadable files
            }
        }
    }

    return sources
}

/**
 * Format loaded instructions into a string for the system prompt.
 */
export function formatAgentInstructions(sources: InstructionSource[]): string {
    if (sources.length === 0) return ""

    const sections = sources.map((source) => {
        const label = source.scope === "global" ? "Global" : "Project"
        return `<!-- ${label} instructions from ${source.path} -->\n${source.content}`
    })

    return `\n# Agent Instructions\n\n${sections.join("\n\n")}\n`
}
