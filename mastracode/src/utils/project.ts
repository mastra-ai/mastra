import path from "node:path"
import fs from "node:fs"
import os from "node:os"

/**
 * Get the application data directory for mastra-code
 * - macOS: ~/Library/Application Support/mastra-code
 * - Linux: ~/.local/share/mastra-code
 * - Windows: %APPDATA%/mastra-code
 */
export function getAppDataDir(): string {
    const platform = os.platform()
    let baseDir: string

    if (platform === "darwin") {
        baseDir = path.join(os.homedir(), "Library", "Application Support")
    } else if (platform === "win32") {
        baseDir =
            process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming")
    } else {
        // Linux and others - follow XDG spec
        baseDir =
            process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share")
    }

    const appDir = path.join(baseDir, "mastra-code")

    // Ensure directory exists
    if (!fs.existsSync(appDir)) {
        fs.mkdirSync(appDir, { recursive: true })
    }

    return appDir
}