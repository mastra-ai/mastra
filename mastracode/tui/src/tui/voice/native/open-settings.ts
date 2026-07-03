/**
 * Open a macOS settings deep link (e.g. an `x-apple.systempreferences:` URL) so
 * the TUI can take the user straight to the right Privacy & Security pane
 * instead of telling them to go find it themselves.
 */

import { spawn } from 'node:child_process';

/**
 * Open `url` with the macOS `open` command. Resolves `true` if the launcher
 * started cleanly, `false` otherwise (non-darwin, spawn failure, or non-zero
 * exit). Never throws — opening settings is best-effort guidance.
 */
export async function openMacSettings(url: string): Promise<boolean> {
  if (process.platform !== 'darwin') return false;
  return new Promise(resolve => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn('open', [url], { stdio: 'ignore' });
    } catch {
      resolve(false);
      return;
    }
    child.on('error', () => resolve(false));
    child.on('exit', code => resolve(code === 0));
  });
}
