/**
 * Detects pino transport targets in code.
 * Matches patterns like:
 * - pino.transport({ target: "package-name" })
 * - pino.transport({ targets: [{ target: "package-name" }] })
 *
 * @param code - The source code to analyze
 * @returns Set of detected transport package names
 */
export function detectPinoTransports(code: string): Set<string> {
  const transports = new Set<string>();

  // Match pino.transport({ target: "..." }) - single target
  const singleTargetRegex = /pino\.transport\s*\(\s*\{[^}]*target\s*:\s*["'`]([^"'`]+)["'`]/g;
  let match;
  while ((match = singleTargetRegex.exec(code)) !== null) {
    if (match[1]) {
      transports.add(match[1]);
    }
  }

  // Match targets array: targets: [{ target: "..." }, { target: "..." }]
  const targetsArrayRegex = /targets\s*:\s*\[([^\]]+)\]/g;
  while ((match = targetsArrayRegex.exec(code)) !== null) {
    const arrayContent = match[1];
    if (arrayContent) {
      const targetInArrayRegex = /target\s*:\s*["'`]([^"'`]+)["'`]/g;
      let innerMatch;
      while ((innerMatch = targetInArrayRegex.exec(arrayContent)) !== null) {
        if (innerMatch[1]) {
          transports.add(innerMatch[1]);
        }
      }
    }
  }

  return transports;
}
