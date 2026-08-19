import type { PiCompatibilityDiagnostic } from './compatibility.js';

export function createPiCompatibilityDiagnostic(
  extensionId: string,
  capability: string,
  severity: PiCompatibilityDiagnostic['severity'],
  message: string,
): PiCompatibilityDiagnostic {
  return { extensionId, capability, severity, message };
}

export function formatPiExtensionError(extensionId: string, error: unknown): string {
  return `Pi extension "${extensionId}" failed: ${error instanceof Error ? error.message : String(error)}`;
}
