import type { PlatformProviderConnection } from './platform-connect-providers';

export interface IncidentioIntakeStatus {
  enabled: boolean;
  configured: boolean;
  mode?: 'api-key' | 'platform';
  reason?: string;
}

/** A deployment API key serves follow-ups without a Platform connection. */
export function isIncidentioDirectConfigured(status: IncidentioIntakeStatus | undefined) {
  return Boolean(status?.enabled && status.configured && status.mode === 'api-key' && status.reason === 'ready');
}

export function incidentioCredentialActive(
  status: IncidentioIntakeStatus | undefined,
  connections: PlatformProviderConnection[] | undefined,
) {
  return isIncidentioDirectConfigured(status) || Boolean(connections?.some(c => c.status === 'active'));
}

export interface VantaIntakeStatus {
  enabled: boolean;
  configured: boolean;
  reason: 'ready' | 'missing_config' | 'organization_required' | 'auth_required';
}

/** Vanta reports `ready` per organization whatever its connections say, so an active connection is checked too. */
export function vantaSourcesEnabled(
  status: VantaIntakeStatus | undefined,
  connections: PlatformProviderConnection[] | undefined,
) {
  return status?.reason === 'ready' && Boolean(connections?.some(c => c.status === 'active'));
}
