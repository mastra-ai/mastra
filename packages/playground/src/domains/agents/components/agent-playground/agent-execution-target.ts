import type {
  AgentVersionLabel,
  ListAgentVersionsResponse,
  VersionOverrides,
  VersionSelector,
} from '@mastra/client-js';

export type AgentExecutionTarget = { kind: 'label'; label: string } | { kind: 'version'; versionId: string };

export type AgentExecutionTargetOption = {
  value: string;
  label: string;
  description: string;
  target: AgentExecutionTarget;
};

export type AgentExecutionTargetGroups = {
  labels: AgentExecutionTargetOption[];
  versions: AgentExecutionTargetOption[];
};

const LABEL_PREFIX = 'label:';
const VERSION_PREFIX = 'version:';

const compareAscii = (left: string, right: string): number => {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

const labelOrder = (label: AgentVersionLabel): number => {
  if (label.kind === 'production') return 0;
  if (label.kind === 'custom') return 1;
  return 2;
};

export const encodeAgentExecutionTarget = (target: AgentExecutionTarget): string =>
  target.kind === 'label' ? `${LABEL_PREFIX}${target.label}` : `${VERSION_PREFIX}${target.versionId}`;

export const decodeAgentExecutionTarget = (value: string): AgentExecutionTarget | undefined => {
  if (value.startsWith(LABEL_PREFIX)) {
    const label = value.slice(LABEL_PREFIX.length);
    return label ? { kind: 'label', label } : undefined;
  }

  if (value.startsWith(VERSION_PREFIX)) {
    const versionId = value.slice(VERSION_PREFIX.length);
    return versionId ? { kind: 'version', versionId } : undefined;
  }

  return undefined;
};

export const toAgentVersionSelector = (target: AgentExecutionTarget): VersionSelector =>
  target.kind === 'label' ? { label: target.label } : { versionId: target.versionId };

export const toAgentVersionOverrides = (target: AgentExecutionTarget | undefined): VersionOverrides | undefined =>
  target ? { self: toAgentVersionSelector(target) } : undefined;

export const isAgentExecutionTargetAvailable = (
  target: AgentExecutionTarget,
  labels: AgentVersionLabel[],
  versions: ListAgentVersionsResponse['versions'],
): boolean => {
  if (target.kind === 'label') return labels.some(label => label.name === target.label);
  return versions.some(version => version.id === target.versionId);
};

export const buildAgentExecutionTargetGroups = (
  labels: AgentVersionLabel[],
  versions: ListAgentVersionsResponse['versions'],
): AgentExecutionTargetGroups => ({
  labels: [...labels]
    .sort((left, right) => {
      const kindOrder = labelOrder(left) - labelOrder(right);
      return kindOrder === 0 ? compareAscii(left.name, right.name) : kindOrder;
    })
    .map(label => ({
      value: encodeAgentExecutionTarget({ kind: 'label', label: label.name }),
      label: `${label.name} · v${label.versionNumber}`,
      description: label.kind === 'custom' ? 'Custom release label' : `${label.kind} release label`,
      target: { kind: 'label', label: label.name },
    })),
  versions: [...versions]
    .sort((left, right) => right.versionNumber - left.versionNumber)
    .map(version => ({
      value: encodeAgentExecutionTarget({ kind: 'version', versionId: version.id }),
      label: `v${version.versionNumber}`,
      description: version.changeMessage?.trim() || `Exact version · ${version.id}`,
      target: { kind: 'version', versionId: version.id },
    })),
});

/** Builds only the computed label choices that remain available without custom-label storage support. */
export const getComputedAgentVersionLabels = (versions: ListAgentVersionsResponse['versions']): AgentVersionLabel[] => {
  return getAgentVersionLabelsFromVersions(versions).filter(label => label.kind !== 'custom');
};

/** Reconstructs labels that are already visible on stored-agent version rows. */
export const getAgentVersionLabelsFromVersions = (
  versions: ListAgentVersionsResponse['versions'],
): AgentVersionLabel[] => {
  const labels = new Map<string, AgentVersionLabel>();

  for (const version of versions) {
    for (const name of version.labels ?? []) {
      const current = labels.get(name);
      if (current && current.versionNumber >= version.versionNumber) continue;
      labels.set(name, {
        name,
        kind: name === 'production' || name === 'latest' ? name : 'custom',
        versionId: version.id,
        versionNumber: version.versionNumber,
      });
    }
  }

  return [...labels.values()];
};

/** Enriches version-row labels with authoritative list metadata such as revision tokens. */
export const mergeAgentVersionLabels = (
  versionRowLabels: AgentVersionLabel[],
  listedLabels: AgentVersionLabel[] | undefined,
): AgentVersionLabel[] => {
  if (!listedLabels) return versionRowLabels;

  const versionRowsByName = new Map(versionRowLabels.map(label => [label.name, label]));
  return listedLabels.map(label => ({ ...versionRowsByName.get(label.name), ...label }));
};
