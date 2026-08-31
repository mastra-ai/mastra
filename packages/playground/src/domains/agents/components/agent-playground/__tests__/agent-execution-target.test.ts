import type { AgentVersionLabel, ListAgentVersionsResponse, VersionOverrides } from '@mastra/client-js';
import { describe, expect, it } from 'vitest';

import {
  buildAgentExecutionTargetGroups,
  decodeAgentExecutionTarget,
  encodeAgentExecutionTarget,
  getAgentVersionLabelsFromVersions,
  getComputedAgentVersionLabels,
  isAgentExecutionTargetAvailable,
  mergeAgentVersionLabels,
  toAgentVersionOverrides,
} from '../agent-execution-target';

const versions: ListAgentVersionsResponse['versions'] = [
  {
    id: 'version-12-immutable',
    agentId: 'agent-1',
    versionNumber: 12,
    name: 'Support agent',
    instructions: 'Latest instructions',
    model: { provider: 'openai', name: 'gpt-5.4' },
    changeMessage: 'Candidate release',
    createdAt: '2026-08-30T12:00:00.000Z',
    labels: ['latest', 'staging', 'pr-101'],
  },
  {
    id: 'version-10-immutable',
    agentId: 'agent-1',
    versionNumber: 10,
    name: 'Support agent',
    instructions: 'Production instructions',
    model: { provider: 'openai', name: 'gpt-5.4' },
    createdAt: '2026-08-28T12:00:00.000Z',
    labels: ['production'],
  },
];

const labels: AgentVersionLabel[] = [
  { name: 'latest', kind: 'latest', versionId: 'version-12-immutable', versionNumber: 12 },
  {
    name: 'staging',
    kind: 'custom',
    versionId: 'version-12-immutable',
    versionNumber: 12,
    revisionToken: 'revision-staging',
  },
  {
    name: 'pr-101',
    kind: 'custom',
    versionId: 'version-12-immutable',
    versionNumber: 12,
    revisionToken: 'revision-pr-101',
  },
  { name: 'production', kind: 'production', versionId: 'version-10-immutable', versionNumber: 10 },
];

describe('agent execution target', () => {
  describe('when release labels and exact versions are available', () => {
    it('orders production, custom labels, latest, and descending exact versions', () => {
      const groups = buildAgentExecutionTargetGroups(labels, versions);

      expect(groups.labels.map(option => option.label)).toEqual([
        'production · v10',
        'pr-101 · v12',
        'staging · v12',
        'latest · v12',
      ]);
      expect(groups.versions.map(option => option.label)).toEqual(['v12', 'v10']);
    });

    it('sorts already-ordered custom labels without depending on their input position', () => {
      const alreadyOrderedLabels = [labels[3], labels[2], labels[1], labels[0]].filter(
        (label): label is AgentVersionLabel => label !== undefined,
      );

      expect(buildAgentExecutionTargetGroups(alreadyOrderedLabels, versions).labels.map(option => option.label)).toEqual([
        'production · v10',
        'pr-101 · v12',
        'staging · v12',
        'latest · v12',
      ]);
    });

    it('describes computed and custom label targets distinctly', () => {
      const groups = buildAgentExecutionTargetGroups(labels, versions);

      expect(groups.labels.map(option => option.description)).toEqual([
        'production release label',
        'Custom release label',
        'Custom release label',
        'latest release label',
      ]);
    });

    it('preserves a label selector through the canonical versions transport', () => {
      const target = decodeAgentExecutionTarget(encodeAgentExecutionTarget({ kind: 'label', label: 'pr-101' }));

      expect(toAgentVersionOverrides(target)).toEqual<VersionOverrides>({ self: { label: 'pr-101' } });
    });

    it('preserves an exact selector through the canonical versions transport', () => {
      const target = decodeAgentExecutionTarget(
        encodeAgentExecutionTarget({ kind: 'version', versionId: 'version-12-immutable' }),
      );

      expect(target).toEqual({ kind: 'version', versionId: 'version-12-immutable' });
      expect(toAgentVersionOverrides(target)).toEqual<VersionOverrides>({
        self: { versionId: 'version-12-immutable' },
      });
    });

    it('rejects malformed and empty encoded targets', () => {
      expect(decodeAgentExecutionTarget('not-an-execution-target')).toBeUndefined();
      expect(decodeAgentExecutionTarget('label:')).toBeUndefined();
      expect(decodeAgentExecutionTarget('version:')).toBeUndefined();
    });
  });

  describe('when the selected label no longer exists', () => {
    it('marks the selection unavailable instead of falling back', () => {
      expect(isAgentExecutionTargetAvailable({ kind: 'label', label: 'deleted-label' }, labels, versions)).toBe(false);
    });
  });

  describe('when the selected exact version no longer exists', () => {
    it('marks the selection unavailable instead of matching an unrelated version', () => {
      expect(
        isAgentExecutionTargetAvailable({ kind: 'version', versionId: 'version-deleted' }, labels, versions),
      ).toBe(false);
    });
  });

  describe('when custom-label storage is unsupported', () => {
    it('derives only production and latest from version rows', () => {
      expect(getComputedAgentVersionLabels(versions).map(label => label.name)).toEqual(['latest', 'production']);
    });
  });

  describe('when only stored-agent version rows are readable', () => {
    it('derives custom targets and enriches them when complete label metadata is available', () => {
      const rowLabels = getAgentVersionLabelsFromVersions(versions);

      expect(rowLabels.map(label => label.name)).toEqual(['latest', 'staging', 'pr-101', 'production']);
      expect(rowLabels.find(label => label.name === 'pr-101')).toMatchObject({
        kind: 'custom',
        versionId: 'version-12-immutable',
        versionNumber: 12,
      });
      expect(mergeAgentVersionLabels(rowLabels, labels).find(label => label.name === 'pr-101')).toMatchObject({
        revisionToken: 'revision-pr-101',
      });
    });

    it('keeps the newest row when the same visible label occurs on multiple versions', () => {
      const duplicatedRows = versions
        .map(version => ({ ...version, labels: [...(version.labels ?? []), 'shared-release'] }))
        .toReversed();

      expect(getAgentVersionLabelsFromVersions(duplicatedRows).find(label => label.name === 'shared-release')).toEqual({
        name: 'shared-release',
        kind: 'custom',
        versionId: 'version-12-immutable',
        versionNumber: 12,
      });
    });

    it('uses row-derived labels unchanged until an authoritative label collection is readable', () => {
      const rowLabels = getAgentVersionLabelsFromVersions(versions);

      expect(mergeAgentVersionLabels(rowLabels, undefined)).toBe(rowLabels);
    });
  });
});
