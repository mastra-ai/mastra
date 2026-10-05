// @vitest-environment jsdom
import type { MastraClient } from '@mastra/client-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../test/msw-server';
import { makeWrapper } from '../../../test/render';
import { useScorerVersions } from '../use-scorer-versions';
import { useStoredScorer } from '../use-stored-scorers';

type StoredScorer = Awaited<ReturnType<ReturnType<MastraClient['getStoredScorer']>['details']>>;
type ScorerVersions = Awaited<ReturnType<ReturnType<MastraClient['getStoredScorer']>['listVersions']>>;

const scorer: StoredScorer = {
  id: 'tone',
  status: 'published',
  name: 'Tone',
  type: 'llm-judge',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const versions: ScorerVersions = {
  versions: [],
  total: 0,
  page: 0,
  perPage: 20,
  hasMore: false,
};

afterEach(() => cleanup());

describe('useStoredScorer', () => {
  describe('when the scorer exists', () => {
    it('returns its details', async () => {
      server.use(http.get('*/api/stored/scorers/tone', () => HttpResponse.json(scorer)));
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useStoredScorer('tone'), { wrapper });
      await waitFor(() => expect(result.current.data?.name).toBe('Tone'));
    });
  });
});

describe('useScorerVersions', () => {
  describe('when the scorer has no versions', () => {
    it('returns an empty list', async () => {
      server.use(http.get('*/api/stored/scorers/tone/versions', () => HttpResponse.json(versions)));
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useScorerVersions({ scorerId: 'tone' }), { wrapper });
      await waitFor(() => expect(result.current.data?.versions).toEqual([]));
    });
  });
});
