import { describe, expect, it } from 'vitest';
import type { VersionOverrides } from '../mastra/types';
import { MASTRA_VERSIONS_KEY, RequestContext } from '../request-context';
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
      { agents: { shared: { versionId: 'call' } } },
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

  it('does not introduce a selector when none was configured', () => {
    const context = new RequestContext();
    expect(resolveVersionContext(context, undefined, undefined, undefined)).toBeUndefined();
    expect(context.has(MASTRA_VERSIONS_KEY)).toBe(false);
  });
});
