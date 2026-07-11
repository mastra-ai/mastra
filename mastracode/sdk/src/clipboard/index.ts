/**
 * Platform-specific clipboard image extraction.
 *
 * Checks the system clipboard for image data and returns it as base64.
 * Uses synchronous execution (execSync) since this only runs on paste events.
 */

import { execSync } from 'node:child_process';
import { readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface ClipboardImage {
  data: string; // base64-encoded image data or a remote image URL
  mimeType: string;
}

/**
 * Read plain text from the system clipboard.
 * Returns null if clipboard is empty or reading fails.
 */
export function getClipboardText(): string | null {
  try {
    if (process.platform === 'darwin') {
      const text = execSync('pbpaste', {
        encoding: 'utf-8',
        timeout: 3000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return text.length > 0 ? text : null;
    }
    if (process.platform === 'linux') {
      // Try xclip first, then wl-paste
      try {
        const text = execSync('xclip -selection clipboard -o', {
          encoding: 'utf-8',
          timeout: 3000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        return text.length > 0 ? text : null;
      } catch {
        const text = execSync('wl-paste', {
          encoding: 'utf-8',
          timeout: 3000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        return text.length > 0 ? text : null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Write plain text to the system clipboard.
 * Returns true on success, false on failure.
 */
export function setClipboardText(text: string): boolean {
  try {
    if (process.platform === 'darwin') {
      execSync('pbcopy', {
        input: text,
        timeout: 3000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return true;
    }
    if (process.platform === 'linux') {
      try {
        execSync('xclip -selection clipboard', {
          input: text,
          timeout: 3000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        return true;
      } catch {
        execSync('wl-copy', {
          input: text,
          timeout: 3000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Check the system clipboard for image data and return it as base64.
 * Returns null if no image data is found or extraction fails.
 */
export function getClipboardImage(): ClipboardImage | null {
  try {
    if (process.platform === 'darwin') {
      return getMacClipboardImage();
    }
    if (process.platform === 'linux') {
      return getLinuxClipboardImage();
    }
    return null;
  } catch {
    return null;
  }
}

// =============================================================================
// macOS
// =============================================================================

function getMacClipboardImage(): ClipboardImage | null {
  return (
    tryReadMacClipboardImage({
      coercion: '«class PNGf»',
      extension: 'png',
      mimeType: 'image/png',
    }) ??
    tryReadMacClipboardImage({
      coercion: 'TIFF picture',
      extension: 'tiff',
      mimeType: 'image/tiff',
    }) ??
    tryReadMacClipboardImage({
      coercion: '«class TIFF»',
      extension: 'tiff',
      mimeType: 'image/tiff',
    })
  );
}

function tryReadMacClipboardImage({
  coercion,
  extension,
  mimeType,
}: {
  coercion: string;
  extension: string;
  mimeType: string;
}): ClipboardImage | null {
  const tmpFile = join(tmpdir(), `mastra-clipboard-${Date.now()}.${extension}`);

  try {
    const script = `
			set theImage to the clipboard as ${coercion}
			set theFile to open for access POSIX file "${tmpFile}" with write permission
			write theImage to theFile
			close access theFile
		`;
    execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const buffer = readFileSync(tmpFile);
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      return null;
    }

    return {
      data: buffer.toString('base64'),
      mimeType,
    };
  } catch {
    return null;
  } finally {
    try {
      unlinkSync(tmpFile);
    } catch {
      // ignore cleanup errors
    }
  }
}

// =============================================================================
// Linux
// =============================================================================

function getLinuxClipboardImage(): ClipboardImage | null {
  // Try xclip first, then wl-paste (Wayland)
  return getLinuxClipboardImageXclip() ?? getLinuxClipboardImageWlPaste();
}

function getLinuxClipboardImageXclip(): ClipboardImage | null {
  try {
    // Check available targets
    const targets = execSync('xclip -selection clipboard -target TARGETS -o', {
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (!targets.includes('image/png')) {
      return null;
    }

    // Extract PNG data
    const buffer = execSync('xclip -selection clipboard -target image/png -o', {
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 50 * 1024 * 1024, // 50MB max
    });

    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      return null;
    }

    return {
      data: buffer.toString('base64'),
      mimeType: 'image/png',
    };
  } catch {
    return null;
  }
}

function getLinuxClipboardImageWlPaste(): ClipboardImage | null {
  try {
    // Check if wl-paste is available and clipboard has image
    const types = execSync('wl-paste --list-types', {
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (!types.includes('image/png')) {
      return null;
    }

    // Extract PNG data
    const buffer = execSync('wl-paste --type image/png', {
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 50 * 1024 * 1024,
    });

    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      return null;
    }

    return {
      data: buffer.toString('base64'),
      mimeType: 'image/png',
    };
  } catch {
    return null;
  }
}
