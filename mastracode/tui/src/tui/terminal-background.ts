/**
 * Optional terminal background painting (preferences.terminalBackground).
 *
 * OSC 11 sets the terminal's default background color and OSC 111 resets it
 * to the user's configured color. Painting is off by default because it
 * overrides the user's own terminal setup; when on, the background is reset on
 * every exit or suspend so the terminal never stays recolored outside Mastra Code.
 */

let enabled = false;
let paintedHex: string | undefined;
let onScreen = false;

function write(sequence: string): void {
  if (!process.stdout.isTTY) return;
  try {
    process.stdout.write(sequence);
  } catch {
    // stdout may already be closed during exit
  }
}

export function setTerminalBackgroundEnabled(value: boolean): void {
  enabled = value;
  if (!enabled) clearTerminalBackground();
}

/** Paint the terminal background, or reset it when the theme has no background of its own. */
export function paintTerminalBackground(hex: string | undefined): void {
  if (!enabled || !hex) {
    clearTerminalBackground();
    return;
  }
  paintedHex = hex;
  write(`\x1b]11;${hex}\x07`);
  onScreen = true;
}

/** Forget the painted color and restore the user's own background. */
export function clearTerminalBackground(): void {
  paintedHex = undefined;
  resetTerminalBackground();
}

/** Restore the user's own background but remember the painted color (exit, suspend, detection). */
export function resetTerminalBackground(): void {
  if (!onScreen) return;
  write('\x1b]111\x07');
  onScreen = false;
}

/** Repaint the remembered color after a suspend. */
export function restoreTerminalBackground(): void {
  if (enabled && paintedHex && !onScreen) paintTerminalBackground(paintedHex);
}
