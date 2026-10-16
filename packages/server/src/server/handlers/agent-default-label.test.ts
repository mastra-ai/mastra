import { RequestContext, MASTRA_VERSIONS_KEY } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';
import { agentVersionOverridesSchema } from '../schemas/agents';
import {
  getPinnedAgentVersionId,
  normalizeVersionOverrides,
  resolveContinuationVersioning,
  resolveExecutionVersioning,
} from './agents';
import { parseResponseAgentVersionPins } from './responses.storage';

describe('graph-wide agent version defaults', () => {
  it('rejects the removed self selector instead of silently dropping it', () => {
    expect(agentVersionOverridesSchema.safeParse({ self: { label: 'candidate' } }).success).toBe(false);
    expect(() => normalizeVersionOverrides({ self: { label: 'candidate' } } as never)).toThrow();
  });
  it('accepts and retains defaultLabel at the HTTP schema and normalization boundaries', () => {
    const versions = { defaultLabel: 'candidate', defaultStatus: 'published' as const };
    expect(agentVersionOverridesSchema.parse(versions)).toEqual(versions);
    expect(normalizeVersionOverrides(versions)).toEqual(versions);
  });

  it('selects the root from defaultLabel and preserves the policy for its dependencies', () => {
    const versions = { defaultLabel: 'candidate', defaultStatus: 'draft' as const };
    expect(resolveExecutionVersioning({ agentId: 'root', versions })).toEqual({
      versionOptions: { label: 'candidate' },
      delegatedVersions: versions,
    });
  });

  it('lets an explicit root override win without changing the graph default', () => {
    const versions = { defaultLabel: 'candidate', agents: { root: { versionId: 'root-v1' } } };
    expect(resolveExecutionVersioning({ agentId: 'root', versions })).toEqual({
      versionOptions: { versionId: 'root-v1' },
      delegatedVersions: versions,
    });
  });

  it('merges request context and call policy using Core precedence', () => {
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_VERSIONS_KEY, { defaultLabel: 'stable', agents: { child: { versionId: 'child-v1' } } });
    expect(
      resolveExecutionVersioning({ agentId: 'root', versions: { defaultLabel: 'candidate' }, requestContext }),
    ).toEqual({
      versionOptions: { label: 'candidate' },
      delegatedVersions: { defaultLabel: 'candidate', agents: { child: { versionId: 'child-v1' } } },
    });
  });

  it('rejects a mutable graph default before loading continuation storage', async () => {
    const getStorage = vi.fn();
    await expect(
      resolveContinuationVersioning({
        mastra: { getStorage } as never,
        agentId: 'root',
        runId: 'run',
        versions: { defaultLabel: 'candidate' },
      }),
    ).rejects.toThrow('mutable default label');
    expect(getStorage).not.toHaveBeenCalled();
  });

  it('preserves graph-only Response pins and accepts matching scoped root duplicates', () => {
    expect(parseResponseAgentVersionPins({ resolvedAgentIds: ['root', 'child'] })).toEqual({
      resolvedAgentIds: ['child', 'root'],
    });
    expect(
      parseResponseAgentVersionPins({
        root: { agentId: 'root', versionId: 'v1' },
        agents: { root: { agentId: 'root', versionId: 'v1' } },
        resolvedAgentIds: ['root'],
      }),
    ).toEqual({ root: { agentId: 'root', versionId: 'v1' }, resolvedAgentIds: ['root'] });
  });

  it.each([
    { root: { agentId: 'root', versionId: 'v1' }, resolvedAgentIds: ['child'] },
    {
      root: { agentId: 'root', versionId: 'v1', selectedLabel: 'first' },
      agents: { root: { agentId: 'root', versionId: 'v1', selectedLabel: 'second' } },
    },
    { resolvedAgentIds: [] },
  ])('rejects corrupt Response pins without dropping their metadata', pins => {
    expect(parseResponseAgentVersionPins(pins)).toBeNull();
  });

  it('rejects workflow pins outside their captured graph', () => {
    expect(() =>
      getPinnedAgentVersionId(
        {
          snapshot: {
            agentVersionPins: {
              root: { agentId: 'root', versionId: 'v1' },
              agents: { child: { agentId: 'child', versionId: 'child-v1' } },
              resolvedAgentIds: ['root'],
            },
          },
        },
        'root',
      ),
    ).toThrow('outside its resolved graph');
  });
});
