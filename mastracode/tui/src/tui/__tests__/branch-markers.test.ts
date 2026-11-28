import { describe, expect, it, vi } from 'vitest';
import { loadBranchForkMarkers } from '../branch-markers.js';

function createState(threadOverrides: Record<string, unknown> = {}) {
  return {
    session: {
      thread: {
        getId: vi.fn(() => 'thread-1'),
        getBranchInfo: vi.fn(async () => null),
        getParent: vi.fn(async () => null),
        listBranches: vi.fn(async () => ({ branches: [] })),
        ...threadOverrides,
      },
    },
  };
}

describe('loadBranchForkMarkers', () => {
  it('returns no markers without an active thread', async () => {
    const state = createState({ getId: vi.fn(() => null) });

    const markers = await loadBranchForkMarkers(state as never);

    expect(markers.size).toBe(0);
    expect(state.session.thread.listBranches).not.toHaveBeenCalled();
  });

  it('returns no markers for an ordinary thread', async () => {
    const markers = await loadBranchForkMarkers(createState() as never);

    expect(markers.size).toBe(0);
  });

  it('marks the fork point on a branch view with its parent', async () => {
    const state = createState({
      getBranchInfo: vi.fn(async () => ({
        parentThreadId: 'parent-1',
        branchPointMessageId: 'msg-fork',
        branchPointCreatedAt: new Date('2026-09-18T00:00:00Z'),
        branchCreatedAt: new Date('2026-09-19T12:00:00Z'),
      })),
      getParent: vi.fn(async () => ({ id: 'parent-1', title: 'Root Thread' })),
    });

    const markers = await loadBranchForkMarkers(state as never);

    const lines = markers.get('msg-fork');
    expect(lines).toHaveLength(1);
    expect(lines?.[0]).toContain('⎇ Branched from "Root Thread"');
    expect(lines?.[0]).toContain('/parent');
  });

  it('marks fork points on the source view for each child branch', async () => {
    const state = createState({
      listBranches: vi.fn(async () => ({
        branches: [
          { thread: { id: 'branch-1', title: 'First' }, branch: { branchPointMessageId: 'msg-a' } },
          { thread: { id: 'branch-2', title: 'Second' }, branch: { branchPointMessageId: 'msg-a' } },
          { thread: { id: 'branch-3', title: 'Third' }, branch: { branchPointMessageId: 'msg-b' } },
        ],
      })),
    });

    const markers = await loadBranchForkMarkers(state as never);

    expect(markers.get('msg-a')).toHaveLength(2);
    expect(markers.get('msg-a')?.[0]).toContain('⎇ Branch "First" forked here');
    expect(markers.get('msg-b')).toHaveLength(1);
  });

  it('renders without markers when lineage loading throws', async () => {
    const state = createState({
      listBranches: vi.fn(async () => Promise.reject(new Error('BRANCHING_UNSUPPORTED'))),
    });

    const markers = await loadBranchForkMarkers(state as never);

    expect(markers.size).toBe(0);
  });
});
