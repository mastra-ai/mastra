export const PI_COMPATIBILITY_TARGET_VERSION = '0.84.2' as const;

export type PiCapabilitySupport = 'direct' | 'adapted' | 'version-gated' | 'unsupported';

export type PiPackageCompatibilityStatus = 'pi-compatible' | 'pi-partial' | 'pi-incompatible';

export interface PiCompatibilityEvidence {
  source: string;
  detail?: string;
}

export interface PiCompatibilityDiagnostic {
  severity: 'info' | 'warning' | 'error';
  message: string;
  capability?: string;
  extensionId?: string;
}

export interface PiCapabilityCompatibility {
  name: string;
  support: PiCapabilitySupport;
  evidence: PiCompatibilityEvidence[];
  diagnostics: PiCompatibilityDiagnostic[];
}

export interface PiPackageCompatibility {
  targetApiVersion: typeof PI_COMPATIBILITY_TARGET_VERSION;
  status: PiPackageCompatibilityStatus;
  capabilities: PiCapabilityCompatibility[];
  diagnostics: PiCompatibilityDiagnostic[];
}

export function getPiPackageCompatibilityStatus(
  capabilities: readonly PiCapabilityCompatibility[],
): PiPackageCompatibilityStatus {
  const supportedCount = capabilities.filter(
    capability => capability.support === 'direct' || capability.support === 'adapted',
  ).length;
  const gatedCount = capabilities.filter(capability => capability.support === 'version-gated').length;
  const unsupportedCount = capabilities.filter(capability => capability.support === 'unsupported').length;

  if (supportedCount === 0) {
    return 'pi-incompatible';
  }
  if (gatedCount > 0 || unsupportedCount > 0) {
    return 'pi-partial';
  }
  return 'pi-compatible';
}

export function createPiPackageCompatibility(
  capabilities: PiCapabilityCompatibility[],
  diagnostics: PiCompatibilityDiagnostic[] = [],
): PiPackageCompatibility {
  return {
    targetApiVersion: PI_COMPATIBILITY_TARGET_VERSION,
    status: getPiPackageCompatibilityStatus(capabilities),
    capabilities,
    diagnostics,
  };
}
