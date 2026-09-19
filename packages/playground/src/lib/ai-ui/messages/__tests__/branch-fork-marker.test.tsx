import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { BranchForkMarker } from '../branch-fork-marker';
import { buildBranchForkMarkers } from '../build-branch-fork-markers';
import type { ThreadBranchesInfo } from '@/domains/memory/hooks';
import {
  branchHistoryFromChild,
  branchHistoryOfRoot,
  childBranchesOfSource,
  CHILD_THREAD_ID,
  FORK_MESSAGE_ID,
  SOURCE_THREAD_ID,
} from '@/domains/memory/hooks/__tests__/fixtures/thread-branches';
import { TestLinkProvider } from '@/test/link-provider';

const AGENT_ID = 'agent-branch';

const supportedLineage = (
  history: typeof branchHistoryOfRoot,
  branches: typeof childBranchesOfSource,
): ThreadBranchesInfo => {
  const own = history.history[history.history.length - 1];
  const parentThread = own?.branch ? (history.history[history.history.length - 2]?.thread ?? null) : null;
  return { isSupported: true, parentThread, fork: own?.branch ?? null, branches: branches.branches };
};

describe('buildBranchForkMarkers', () => {
  describe('when the current thread is a branch', () => {
    it('keys an origin marker by the fork message id pointing at the parent', () => {
      const markers = buildBranchForkMarkers(
        supportedLineage(branchHistoryFromChild, { ...childBranchesOfSource, branches: [] }),
      );

      expect(markers.size).toBe(1);
      const origin = markers.get(FORK_MESSAGE_ID);
      expect(origin).toHaveLength(1);
      expect(origin?.[0]?.kind).toBe('origin');
      expect(origin?.[0]?.targetThreadId).toBe(SOURCE_THREAD_ID);
    });
  });

  describe('when the current thread has child branches', () => {
    it('groups a child marker per branch at the shared fork message id', () => {
      const markers = buildBranchForkMarkers(supportedLineage(branchHistoryOfRoot, childBranchesOfSource));

      const children = markers.get(FORK_MESSAGE_ID);
      expect(children).toHaveLength(2);
      expect(children?.map(marker => marker.targetThreadId)).toEqual([CHILD_THREAD_ID, 'thread-branch-child-2']);
    });
  });

  describe('when memory does not support branching', () => {
    it('returns no markers', () => {
      expect(buildBranchForkMarkers({ isSupported: false, parentThread: null, fork: null, branches: [] }).size).toBe(0);
      expect(buildBranchForkMarkers(undefined).size).toBe(0);
    });
  });
});

describe('BranchForkMarker', () => {
  afterEach(() => {
    cleanup();
  });

  describe('when the marker points at the parent thread', () => {
    it('links to the parent thread', () => {
      render(
        <TestLinkProvider>
          <BranchForkMarker
            agentId={AGENT_ID}
            marker={{ kind: 'origin', targetThreadId: SOURCE_THREAD_ID, targetTitle: 'Source thread', timestamp: '' }}
          />
        </TestLinkProvider>,
      );

      expect(screen.getByText('Branched from Source thread')).toBeDefined();
      expect(screen.getByRole('link', { name: 'View parent' }).getAttribute('href')).toBe(
        `/agents/${AGENT_ID}/threads/${SOURCE_THREAD_ID}`,
      );
    });
  });

  describe('when the marker points at a child branch', () => {
    it('links to the child branch', () => {
      render(
        <TestLinkProvider>
          <BranchForkMarker
            agentId={AGENT_ID}
            marker={{ kind: 'child', targetThreadId: CHILD_THREAD_ID, targetTitle: 'Child branch', timestamp: '' }}
          />
        </TestLinkProvider>,
      );

      expect(screen.getByText('Branch Child branch forked here')).toBeDefined();
      expect(screen.getByRole('link', { name: 'View branch' }).getAttribute('href')).toBe(
        `/agents/${AGENT_ID}/threads/${CHILD_THREAD_ID}`,
      );
    });
  });
});
