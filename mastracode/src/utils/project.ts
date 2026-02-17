/**
 * Project detection utilities.
 *
 * Detects project identity from git repo or filesystem path.
 * Handles git worktrees by finding the main repository.
 */

import { execSync } from "node:child_process"
import { createHash } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProjectInfo {
    /** Unique resource ID for this project (used for thread grouping) */
    resourceId: string
    /** Human-readable project name */
    name: string
    /** Absolute path to the project root */
    rootPath: string
    /** Git remote URL if available */
    gitUrl?: string
    /** Current git branch */
    gitBranch?: string
    /** Whether this is a git worktree */
    isWorktree: boolean
    /** Path to main git repo (different from rootPath if worktree) */
    mainRepoPath?: string
    /** Whether the resourceId was explicitly overridden (env var or config) */
    resourceIdOverride?: boolean
}

export interface StorageConfig {
    url: string
    authToken?: string
    isRemote: boolean
}

export type OmScope = "thread" | "resource"

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

function git(args: string, cwd: string): string | undefined {
    try {
        return execSync(`git ${args}`, {
            cwd,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
        }).trim()
    } catch {
        return undefined
    }
}

function slugify(str: string): string {
    return str
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
}

function shortHash(str: string): string {
    return createHash("sha256").update(str).digest("hex").slice(0, 12)
}

function normalizeGitUrl(url: string): string {
    return url
        .replace(/\.git$/, "")
        .replace(/^git@([^:]+):/, "https://$1/")
        .replace(/^ssh:\/\/git@/, "https://")
        .toLowerCase()
}

// ---------------------------------------------------------------------------
// Project detection
// ---------------------------------------------------------------------------

export function detectProject(projectPath: string): ProjectInfo {
    const absolutePath = path.resolve(projectPath)

    const gitDir = git("rev-parse --git-dir", absolutePath)
    const isGitRepo = gitDir !== undefined

    let rootPath = absolutePath
    let gitUrl: string | undefined
    let gitBranch: string | undefined
    let isWorktree = false
    let mainRepoPath: string | undefined

    if (isGitRepo) {
        rootPath = git("rev-parse --show-toplevel", absolutePath) || absolutePath

        const commonDir = git("rev-parse --git-common-dir", absolutePath)
        if (commonDir && commonDir !== ".git" && commonDir !== gitDir) {
            isWorktree = true
            mainRepoPath = path.dirname(path.resolve(rootPath, commonDir))
        }

        gitUrl = git("remote get-url origin", absolutePath)
        if (!gitUrl) {
            const remotes = git("remote", absolutePath)
            if (remotes) {
                const firstRemote = remotes.split("\n")[0]
                if (firstRemote) {
                    gitUrl = git(`remote get-url ${firstRemote}`, absolutePath)
                }
            }
        }

        gitBranch = git("rev-parse --abbrev-ref HEAD", absolutePath)
    }

    // Check for explicit override first
    const override = getResourceIdOverride(rootPath)
    if (override) {
        const baseName = gitUrl
            ? gitUrl.split("/").pop()?.replace(/\.git$/, "") || "project"
            : path.basename(rootPath)

        return {
            resourceId: override,
            name: baseName,
            rootPath,
            gitUrl,
            gitBranch,
            isWorktree,
            mainRepoPath,
            resourceIdOverride: true,
        }
    }

    let resourceIdSource: string
    if (gitUrl) {
        resourceIdSource = normalizeGitUrl(gitUrl)
    } else if (mainRepoPath) {
        resourceIdSource = mainRepoPath
    } else {
        resourceIdSource = rootPath
    }

    const baseName = gitUrl
        ? gitUrl.split("/").pop()?.replace(/\.git$/, "") || "project"
        : path.basename(rootPath)

    const resourceId = `${slugify(baseName)}-${shortHash(resourceIdSource)}`

    return {
        resourceId,
        name: baseName,
        rootPath,
        gitUrl,
        gitBranch,
        isWorktree,
        mainRepoPath,
    }
}

// ---------------------------------------------------------------------------
// Application data directory
// ---------------------------------------------------------------------------

export function getAppDataDir(): string {
    const platform = os.platform()
    let baseDir: string

    if (platform === "darwin") {
        baseDir = path.join(os.homedir(), "Library", "Application Support")
    } else if (platform === "win32") {
        baseDir = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming")
    } else {
        baseDir = process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share")
    }

    const appDir = path.join(baseDir, "mastra-code")

    if (!fs.existsSync(appDir)) {
        fs.mkdirSync(appDir, { recursive: true })
    }

    return appDir
}

export function getDatabasePath(): string {
    if (process.env.MASTRA_DB_PATH) {
        return process.env.MASTRA_DB_PATH
    }
    return path.join(getAppDataDir(), "mastra.db")
}

// ---------------------------------------------------------------------------
// Storage configuration
// ---------------------------------------------------------------------------

export function getStorageConfig(projectDir?: string): StorageConfig {
    if (process.env.MASTRA_DB_URL) {
        return {
            url: process.env.MASTRA_DB_URL,
            authToken: process.env.MASTRA_DB_AUTH_TOKEN,
            isRemote: !process.env.MASTRA_DB_URL.startsWith("file:"),
        }
    }

    if (projectDir) {
        const projectConfig = loadDatabaseConfig(
            path.join(projectDir, ".mastracode", "database.json"),
        )
        if (projectConfig) return projectConfig
    }

    const globalConfig = loadDatabaseConfig(
        path.join(os.homedir(), ".mastracode", "database.json"),
    )
    if (globalConfig) return globalConfig

    return {
        url: `file:${getDatabasePath()}`,
        isRemote: false,
    }
}

function loadDatabaseConfig(filePath: string): StorageConfig | null {
    try {
        if (!fs.existsSync(filePath)) return null
        const raw = fs.readFileSync(filePath, "utf-8")
        const parsed = JSON.parse(raw)
        if (typeof parsed?.url === "string" && parsed.url) {
            return {
                url: parsed.url,
                authToken: typeof parsed.authToken === "string" ? parsed.authToken : undefined,
                isRemote: !parsed.url.startsWith("file:"),
            }
        }
        return null
    } catch {
        return null
    }
}

// ---------------------------------------------------------------------------
// User identity
// ---------------------------------------------------------------------------

export function getUserId(projectDir?: string): string {
    if (process.env.MASTRA_USER_ID) {
        return process.env.MASTRA_USER_ID
    }

    const cwd = projectDir || process.cwd()
    const email = git("config user.email", cwd)
    if (email) return email

    return os.userInfo().username || "unknown"
}

// ---------------------------------------------------------------------------
// Observational Memory scope
// ---------------------------------------------------------------------------

export function getOmScope(projectDir?: string): OmScope {
    const envScope = process.env.MASTRA_OM_SCOPE
    if (envScope === "thread" || envScope === "resource") {
        return envScope
    }

    if (projectDir) {
        const scope = loadOmScopeFromConfig(
            path.join(projectDir, ".mastracode", "database.json"),
        )
        if (scope) return scope
    }

    const scope = loadOmScopeFromConfig(
        path.join(os.homedir(), ".mastracode", "database.json"),
    )
    if (scope) return scope

    return "thread"
}

function loadOmScopeFromConfig(filePath: string): OmScope | null {
    try {
        if (!fs.existsSync(filePath)) return null
        const raw = fs.readFileSync(filePath, "utf-8")
        const parsed = JSON.parse(raw)
        if (parsed?.omScope === "thread" || parsed?.omScope === "resource") {
            return parsed.omScope
        }
        return null
    } catch {
        return null
    }
}

// ---------------------------------------------------------------------------
// Resource ID override
// ---------------------------------------------------------------------------

export function getResourceIdOverride(projectDir?: string): string | null {
    if (process.env.MASTRA_RESOURCE_ID) {
        return process.env.MASTRA_RESOURCE_ID
    }

    if (projectDir) {
        const rid = loadStringField(
            path.join(projectDir, ".mastracode", "database.json"),
            "resourceId",
        )
        if (rid) return rid
    }

    const rid = loadStringField(
        path.join(os.homedir(), ".mastracode", "database.json"),
        "resourceId",
    )
    if (rid) return rid

    return null
}

function loadStringField(filePath: string, field: string): string | null {
    try {
        if (!fs.existsSync(filePath)) return null
        const raw = fs.readFileSync(filePath, "utf-8")
        const parsed = JSON.parse(raw)
        const value = parsed?.[field]
        if (typeof value === "string" && value) return value
        return null
    } catch {
        return null
    }
}
