import type { FactoryIntegration } from './base.js';

const DISPLAY_NAMES: Record<string, string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  incidentio: 'incident.io',
  jira: 'Jira',
  linear: 'Linear',
  vanta: 'Vanta',
};

function displayName(id: string): string {
  return DISPLAY_NAMES[id] ?? id;
}

/**
 * One line saying which integrations have a connected account, so a fresh
 * project doesn't read as if every provider were in use.
 */
export async function describeIntegrations(integrations: readonly FactoryIntegration[]): Promise<string | undefined> {
  const statuses = await Promise.all(
    integrations.map(integration =>
      integration.hasActiveConnections?.().then(
        connected => (connected ? 'connected' : 'available'),
        () => 'status unknown' as const,
      ),
    ),
  );
  const groups = { connected: [] as string[], available: [] as string[], 'status unknown': [] as string[] };
  statuses.forEach((status, i) => status && groups[status].push(displayName(integrations[i]!.id)));

  const parts = Object.entries(groups)
    .filter(([, names]) => names.length > 0)
    .map(([status, names]) => `${names.join(', ')} ${status}`);
  if (parts.length === 0) return undefined;
  if (groups.connected.length === 0 && groups['status unknown'].length === 0) parts.unshift('none connected');
  return `Intake: ${parts.join(' · ')}`;
}

export async function logIntegrationSummary(integrations: readonly FactoryIntegration[]): Promise<void> {
  const line = await describeIntegrations(integrations);
  if (line) console.info(`◇ ${line}`);
}
