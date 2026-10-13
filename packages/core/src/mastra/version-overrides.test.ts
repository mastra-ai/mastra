import { describe, expect, it } from 'vitest';
import { getAgentVersionSelector, mergeVersionOverrides } from './types';

describe('agent version selection defaults', () => {
  it('uses the same precedence for the directly invoked agent and its dependencies', () => {
    const versions = {
      defaultLabel: 'candidate',
      defaultStatus: 'published' as const,
      agents: {
        root: { versionId: 'root-v1' },
        child: { status: 'draft' as const },
      },
    };

    expect(getAgentVersionSelector(versions, 'root')).toEqual({ versionId: 'root-v1' });
    expect(getAgentVersionSelector(versions, 'child')).toEqual({ status: 'draft' });
    expect(getAgentVersionSelector(versions, 'grandchild')).toEqual({ label: 'candidate' });
  });

  it('uses the status default only when no agent override or label default is provided', () => {
    expect(getAgentVersionSelector({ defaultStatus: 'published' }, 'root')).toEqual({ status: 'published' });
    expect(getAgentVersionSelector(undefined, 'root')).toBeUndefined();
    expect(getAgentVersionSelector({ agents: { child: { label: 'candidate' } } }, 'root')).toBeUndefined();
  });

  it('merges configuration levels without allowing a default to replace an explicit agent selector', () => {
    const merged = mergeVersionOverrides(
      { defaultLabel: 'production', agents: { root: { versionId: 'root-v1' }, child: { label: 'stable' } } },
      { defaultLabel: 'candidate', agents: { child: { versionId: 'child-v2' } } },
    );

    expect(getAgentVersionSelector(merged, 'root')).toEqual({ versionId: 'root-v1' });
    expect(getAgentVersionSelector(merged, 'child')).toEqual({ versionId: 'child-v2' });
    expect(getAgentVersionSelector(merged, 'grandchild')).toEqual({ label: 'candidate' });
  });
});
