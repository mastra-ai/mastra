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
  const checked = integrations.filter(integration => integration.hasActiveConnections);
  if (checked.length === 0) return undefined;
  const results = await Promise.all(
    checked.map(async integration => {
      try {
        return { name: displayName(integration.id), connected: await integration.hasActiveConnections!() };
      } catch {
        return { name: displayName(integration.id), connected: undefined };
      }
    }),
  );
  const connected = results.filter(result => result.connected === true).map(result => result.name);
  const available = results.filter(result => result.connected === false).map(result => result.name);
  const unknown = results.filter(result => result.connected === undefined).map(result => result.name);

  const parts = [connected.length > 0 ? `${connected.join(', ')} connected` : 'none connected'];
  if (available.length > 0) parts.push(`${available.join(', ')} available`);
  if (unknown.length > 0) parts.push(`${unknown.join(', ')} status unknown`);
  return `Intake: ${parts.join(' · ')}`;
}

export async function logIntegrationSummary(integrations: readonly FactoryIntegration[]): Promise<void> {
  const line = await describeIntegrations(integrations);
  if (line) console.info(`◇ ${line}`);
}
