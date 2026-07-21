/** Provider-neutral intake selection validation and persistence. */

import { getFactoryStorage } from '../runtime-config';
import { getIntakeStorage } from '../storage/domains';
import { DEFAULT_INTAKE_CONFIG } from '../storage/domains/intake/base';
import type { IntakeConfig } from '../storage/domains/intake/base';

export { DEFAULT_INTAKE_CONFIG };
export type { IntakeConfig };

function sanitizeIdList(value: unknown): string[] | null | undefined {
  if (value === null) return null;
  if (!Array.isArray(value) || value.length > 200) return undefined;
  const ids = value.filter((item): item is string => typeof item === 'string' && item.length > 0 && item.length <= 256);
  return ids.length === value.length && new Set(ids).size === ids.length ? ids : undefined;
}

export function parseIntakeConfig(body: unknown): IntakeConfig | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const entries = Object.entries(body);
  if (entries.length > 50) return null;

  const config: IntakeConfig = {};
  for (const [integrationId, value] of entries) {
    if (
      !integrationId ||
      integrationId.length > 128 ||
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value)
    ) {
      return null;
    }
    const selection = value as { enabled?: unknown; sourceIds?: unknown };
    if (typeof selection.enabled !== 'boolean') return null;
    const sourceIds = sanitizeIdList(selection.sourceIds ?? null);
    if (sourceIds === undefined) return null;
    config[integrationId] = { enabled: selection.enabled, sourceIds };
  }
  return config;
}

export async function getIntakeConfig({
  orgId,
  userId,
  integrationIds = [],
}: {
  orgId: string;
  userId: string;
  integrationIds?: string[];
}): Promise<IntakeConfig> {
  const storage = getFactoryStorage();
  await storage.ensureDomainReady('intake');
  const saved = await getIntakeStorage().getConfig({ orgId, userId });
  return Object.fromEntries(
    integrationIds.map(integrationId => [integrationId, saved[integrationId] ?? { enabled: true, sourceIds: null }]),
  );
}

export async function saveIntakeConfig({
  orgId,
  userId,
  config,
}: {
  orgId: string;
  userId: string;
  config: IntakeConfig;
}): Promise<void> {
  const storage = getFactoryStorage();
  await storage.ensureDomainReady('intake');
  await getIntakeStorage().saveConfig({ orgId, userId, config });
}
