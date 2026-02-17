/**
 * Platform-specific clipboard image extraction.
 *
 * Checks the system clipboard for image data and returns it as base64.
 * Uses synchronous execution (execSync) since this only runs on paste events.
 */

import { execSync } from "node:child_process"
import { readFileSync, unlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

export interface ClipboardImage {
    data: string // base64-encoded image data
    mimeType: string
}

/**
 * Check the system clipboard for image data and return it as base64.
 * Returns null if no image data is found or extraction fails.
 */
export function getClipboardImage(): ClipboardImage | null {
    try {
        if (process.platform === "darwin") {
            return getMacClipboardImage()
        }
        if (process.platform === "linux") {
            return getLinuxClipboardImage()
        }
        return null
    } catch {
        return null
    }
}

// =============================================================================
// macOS
// =============================================================================

function getMacClipboardImage(): ClipboardImage | null {
    let clipInfo: string
    try {
        clipInfo = execSync("osascript -e 'clipboard info'", {
            encoding: "utf-8",
            timeout: 3000,
            stdio: ["pipe", "pipe", "pipe"],
        })
    } catch {
        return null
    }

    const hasPng =
        clipInfo.includes("PNGf") || clipInfo.includes("public.png")
    const hasTiff = clipInfo.includes("TIFF")

    if (!hasPng && !hasTiff) {
        return null
    }

    const tmpFile = join(tmpdir(), `mastra-clipboard-${Date.now()}.png`)

    try {
        const clipboardClass = hasPng ? "PNGf" : "TIFF"
        const script = `
            set theImage to the clipboard as «class ${clipboardClass}»
            set theFile to open for access POSIX file "${tmpFile}" with write permission
            write theImage to theFile
            close access theFile
        `
        execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
            timeout: 5000,
            stdio: ["pipe", "pipe", "pipe"],
        })

        const buffer = readFileSync(tmpFile)
        const base64 = buffer.toString("base64")

        return {
            data: base64,
            mimeType: hasPng ? "image/png" : "image/tiff",
        }
    } catch {
        return null
    } finally {
        try {
            unlinkSync(tmpFile)
        } catch {
            // ignore cleanup errors
        }
    }
}

// =============================================================================
// Linux
// =============================================================================

function getLinuxClipboardImage(): ClipboardImage | null {
    return getLinuxClipboardImageXclip() ?? getLinuxClipboardImageWlPaste()
}

function getLinuxClipboardImageXclip(): ClipboardImage | null {
    try {
        const targets = execSync(
            "xclip -selection clipboard -target TARGETS -o",
            {
                encoding: "utf-8",
                timeout: 3000,
                stdio: ["pipe", "pipe", "pipe"],
            },
        )

        if (!targets.includes("image/png")) {
            return null
        }

        const buffer = execSync(
            "xclip -selection clipboard -target image/png -o",
            {
                timeout: 5000,
                stdio: ["pipe", "pipe", "pipe"],
                maxBuffer: 50 * 1024 * 1024,
            },
        )

        if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
            return null
        }

        return {
            data: buffer.toString("base64"),
            mimeType: "image/png",
        }
    } catch {
        return null
    }
}

function getLinuxClipboardImageWlPaste(): ClipboardImage | null {
    try {
        const types = execSync("wl-paste --list-types", {
            encoding: "utf-8",
            timeout: 3000,
            stdio: ["pipe", "pipe", "pipe"],
        })

        if (!types.includes("image/png")) {
            return null
        }

        const buffer = execSync("wl-paste --type image/png", {
            timeout: 5000,
            stdio: ["pipe", "pipe", "pipe"],
            maxBuffer: 50 * 1024 * 1024,
        })

        if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
            return null
        }

        return {
            data: buffer.toString("base64"),
            mimeType: "image/png",
        }
    } catch {
        return null
    }
}
