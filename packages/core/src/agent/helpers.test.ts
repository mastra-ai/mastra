import { describe, expect, it } from 'vitest';
import type { VersionOverrides } from '../mastra/types';
import { MASTRA_VERSIONS_KEY, RequestContext, mergeVersionOverrides } from '../request-context';
import { resolveVersionContext } from './helpers';

describe('version context', () => {
  it('keeps caller selections above request and host defaults without changing the original request', () => {
    const context = new RequestContext();
    const requestVersions: VersionOverrides = {
      agents: { shared: { versionId: 'request' }, requestOnly: { status: 'draft' } },
      defaultStatus: 'draft',
    };
    context.set(MASTRA_VERSIONS_KEY, requestVersions);
    const resolved = resolveVersionContext(
      context,
      requestVersions,
      {
        agents: { shared: { versionId: 'host' }, hostOnly: { status: 'published' } },
        defaultStatus: 'published',
      },
      { versions: { agents: { shared: { versionId: 'call' } } } },
    );
    expect(resolved).toEqual({
      agents: {
        shared: { versionId: 'call' },
        requestOnly: { status: 'draft' },
        hostOnly: { status: 'published' },
      },
      defaultStatus: 'draft',
    });
    expect(context.get(MASTRA_VERSIONS_KEY)).toEqual(resolved);
    expect(requestVersions).toEqual({
      agents: { shared: { versionId: 'request' }, requestOnly: { status: 'draft' } },
      defaultStatus: 'draft',
    });
  });

  it.each(['host', 'request', 'call'] as const)('preserves the sole %s override object on the plain path', source => {
    const context = new RequestContext();
    const versions: VersionOverrides = { defaultStatus: 'draft' };
    const resolved = resolveVersionContext(
      context,
      source === 'request' ? versions : undefined,
      source === 'host' ? versions : undefined,
      { versions: source === 'call' ? versions : undefined },
    );
    expect(resolved).toBe(versions);
    expect(context.get(MASTRA_VERSIONS_KEY)).toBe(versions);
    expect(resolved).not.toHaveProperty('agents');
  });

  it.each(['host', 'request', 'call'] as const)(
    'keeps durable preparation normalization without mutating the sole %s override',
    source => {
      const context = new RequestContext();
      const versions: VersionOverrides = { defaultStatus: 'draft' };
      const resolved = resolveVersionContext(
        context,
        source === 'request' ? versions : undefined,
        source === 'host' ? versions : undefined,
        { versions: source === 'call' ? versions : undefined },
        mergeVersionOverrides,
      );
      expect(resolved).not.toBe(versions);
      expect(resolved).toEqual({ defaultStatus: 'draft', agents: {} });
      expect(versions).toEqual({ defaultStatus: 'draft' });
      expect(context.get(MASTRA_VERSIONS_KEY)).toBe(resolved);
    },
  );

  it('does not introduce a selector when none was configured', () => {
    const context = new RequestContext();
    expect(resolveVersionContext(context, undefined, undefined, undefined)).toBeUndefined();
    expect(context.has(MASTRA_VERSIONS_KEY)).toBe(false);
  });
});
