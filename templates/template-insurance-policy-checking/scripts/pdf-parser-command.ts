import { fileURLToPath } from 'node:url';

/** Static launcher. Invoked as `sh <script> <argv...>` with no `-c` script string. */
export const pdfLimitsScriptPath = fileURLToPath(new URL('./pdf-limits.sh', import.meta.url));

export function pdfParserCommand(
  workerPath: string,
  execPath = process.execPath,
  limitsScript = pdfLimitsScriptPath,
): { command: string; args: string[] } {
  return {
    command: '/bin/sh',
    args: [limitsScript, execPath, '--max-old-space-size=128', '--max-semi-space-size=16', workerPath],
  };
}
