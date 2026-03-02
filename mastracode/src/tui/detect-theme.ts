/**
 * Terminal theme detection for Mastra Code TUI.
 *
 * Detection priority:
 * 1. MASTRA_THEME env var (explicit override)
 * 2. OSC 11 query — asks the terminal for its actual background color
 * 3. COLORFGBG env var (set by some terminal emulators)
 * 4. Default: 'dark'
 */

import type { ThemeMode } from './theme.js';

/**
 * Query the terminal's background color via OSC 11 and compute luminance.
 * Returns 'dark' or 'light', or null if the terminal doesn't respond.
 *
 * The query sends `\x1b]11;?\x07` to stdout. Terminals that support
 * xterm-style OSC queries reply on stdin with something like:
 *   \x1b]11;rgb:0000/0000/0000\x07   (black background → dark)
 *   \x1b]11;rgb:ffff/ffff/ffff\x07   (white background → light)
 *
 * We parse the rgb components, compute relative luminance (WCAG),
 * and classify as dark (luma < 0.5) or light (luma >= 0.5).
 */
function queryTerminalBackground(timeoutMs = 200): Promise<ThemeMode | null> {
  return new Promise(resolve => {
    // Can't query if stdin isn't a TTY
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      resolve(null);
      return;
    }

    let settled = false;
    let buffer = '';
    let wasRaw: boolean;
    let wasResumed = false;
    let timer: NodeJS.Timeout | undefined;

    const cleanup = () => {
      if (settled) return;
      settled = true;
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      process.stdin.removeListener('data', onData);
      // Restore original raw mode state
      try {
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(wasRaw);
        }
      } catch {
        // ignore
      }
      // Only pause stdin if we were the ones who resumed it
      if (wasResumed) {
        process.stdin.pause();
      }
    };

    const onData = (data: Buffer) => {
      buffer += data.toString();

      // Look for the OSC 11 response: \x1b]11;rgb:RRRR/GGGG/BBBB\x07 or \x1b]11;rgb:RRRR/GGGG/BBBB\x1b\\
      const match = buffer.match(/\x1b\]11;rgb:([0-9a-fA-F]+)\/([0-9a-fA-F]+)\/([0-9a-fA-F]+)/);
      if (match) {
        cleanup();

        // Parse RGB components — terminals may respond with 2 or 4 hex digits per component
        const rHex = match[1]!;
        const gHex = match[2]!;
        const bHex = match[3]!;

        // Normalize to 0–1 range. If 4 digits: max is 0xFFFF. If 2 digits: max is 0xFF.
        const normalize = (hex: string) => {
          const val = parseInt(hex, 16);
          return hex.length <= 2 ? val / 0xff : val / 0xffff;
        };

        const r = normalize(rHex);
        const g = normalize(gHex);
        const b = normalize(bHex);

        // WCAG relative luminance
        const linearize = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
        const luma = 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);

        resolve(luma >= 0.5 ? 'light' : 'dark');
        return;
      }
    };

    // Timeout — terminal didn't respond (or doesn't support OSC 11)
    timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeoutMs);

    // Ensure the timeout doesn't keep the process alive
    if (timer.unref) timer.unref();

    try {
      // Save current state and switch to raw mode for reading the response
      wasRaw = process.stdin.isRaw ?? false;
      process.stdin.setRawMode(true);
      if (process.stdin.isPaused()) {
        process.stdin.resume();
        wasResumed = true;
      }
      process.stdin.on('data', onData);

      // Send OSC 11 query — use BEL (\x07) terminator for broadest compatibility
      process.stdout.write('\x1b]11;?\x07');
    } catch {
      // If we can't set raw mode, give up on this method
      cleanup();
      resolve(null);
    }
  });
}

/**
 * Detect COLORFGBG env var.
 * Format: "fg;bg" where bg is an ANSI color index.
 * Color indices 0-6 are dark, 7+ are light.
 */
function detectFromColorFgBg(): ThemeMode | null {
  const colorFgBg = process.env.COLORFGBG;
  if (!colorFgBg) return null;

  const parts = colorFgBg.split(';');
  const bgPart = parts[parts.length - 1];
  if (bgPart === undefined) return null;

  const bgIndex = parseInt(bgPart, 10);
  if (isNaN(bgIndex)) return null;

  // Standard ANSI: 0-6 are dark colors, 7+ are light (7 = white/light gray, 15 = bright white)
  return bgIndex >= 7 ? 'light' : 'dark';
}

/**
 * Detect the terminal's color scheme.
 * Returns 'dark' or 'light'. Does not check persisted settings —
 * the caller should check settings first and only call this for 'auto' mode.
 */
export async function detectTerminalTheme(): Promise<ThemeMode> {
  // 1. Explicit env var override
  const envTheme = process.env.MASTRA_THEME?.toLowerCase();
  if (envTheme === 'light') return 'light';
  if (envTheme === 'dark') return 'dark';

  // 2. OSC 11 query — ask the terminal for its actual background color
  const oscResult = await queryTerminalBackground(200);
  if (oscResult) return oscResult;

  // 3. COLORFGBG env var fallback
  const fgbgResult = detectFromColorFgBg();
  if (fgbgResult) return fgbgResult;

  // 4. Default to dark
  return 'dark';
}
