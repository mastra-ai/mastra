/**
 * Best-effort browser opening for OAuth and other login flows.
 */

import { spawn } from 'node:child_process';

/**
 * Open a URL in the default browser without going through a shell.
 * Only well-formed http(s) URLs are opened; anything else is ignored
 * (the URL is still displayed for the user to open manually).
 */
export function openUrlInBrowser(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return;
  }

  const [cmd, args]: [string, string[]] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
        : ['xdg-open', [url]];

  const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
  // Opening the browser is best-effort — the URL is shown to the user as well.
  child.on('error', () => {});
  child.unref();
}
