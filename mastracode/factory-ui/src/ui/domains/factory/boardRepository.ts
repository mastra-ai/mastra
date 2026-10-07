import type { IntakeConfig } from './services/intake';

export function cardLinearProjectId(source: string, metadata: Record<string, unknown> | undefined) {
  if (source !== 'linear-issue') return undefined;
  if (typeof metadata?.linearProjectId !== 'string') return undefined;
  return metadata.linearProjectId;
}

export function cardRepositorySlug(
  source: string,
  metadata: Record<string, unknown> | undefined,
  config: IntakeConfig | undefined,
) {
  if (typeof metadata?.repository === 'string') return metadata.repository;
  const projectId = cardLinearProjectId(source, metadata);
  if (projectId === undefined) return undefined;
  return config?.linear.repositoryByLinearProject?.[projectId];
}
