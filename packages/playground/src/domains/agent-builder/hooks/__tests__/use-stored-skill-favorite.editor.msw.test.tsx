import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/test/msw-server';
import { makeWrapper, TEST_BASE_URL, waitForMutationsIdle } from '@/test/render';
import { useToggleStoredSkillFavorite } from '../use-stored-skill-favorite';
import { makeStoredSkill } from './fixtures/stored-skills';

const SKILL_ID = 'skill-1';

describe('when Studio users favorite stored skills', () => {
  it('optimistically favorites stored-skill detail and list caches through the real favorite endpoint', async () => {
    server.use(
      http.put(`${TEST_BASE_URL}/api/stored/skills/${SKILL_ID}/favorite`, () =>
        HttpResponse.json({ favorited: true, favoriteCount: 2 }),
      ),
    );

    const { queryClient, wrapper } = makeWrapper();
    const skill = makeStoredSkill({ id: SKILL_ID, isFavorited: false, favoriteCount: 1 });
    queryClient.setQueryData(['stored-skill', SKILL_ID], skill);
    queryClient.setQueryData(['stored-skills', { page: 1 }], {
      skills: [skill],
      total: 1,
      page: 1,
      perPage: 50,
      hasMore: false,
    });

    const { result } = renderHook(() => useToggleStoredSkillFavorite(SKILL_ID), { wrapper });

    await result.current.mutateAsync({ favorited: true });
    await waitForMutationsIdle(queryClient);

    const detail = queryClient.getQueryData<ReturnType<typeof makeStoredSkill>>(['stored-skill', SKILL_ID]);
    const list = queryClient.getQueryData<{ skills: Array<ReturnType<typeof makeStoredSkill>> }>([
      'stored-skills',
      { page: 1 },
    ]);
    expect(detail?.isFavorited).toBe(true);
    expect(detail?.favoriteCount).toBe(2);
    expect(list?.skills[0]?.isFavorited).toBe(true);
    expect(list?.skills[0]?.favoriteCount).toBe(2);
    await waitFor(() => expect(queryClient.getQueryState(['stored-skills', { page: 1 }])?.isInvalidated).toBe(true));
  });

  it('rolls skill favorite cache changes back when the server rejects the mutation', async () => {
    server.use(
      http.put(`${TEST_BASE_URL}/api/stored/skills/${SKILL_ID}/favorite`, () =>
        HttpResponse.json({ message: 'not found' }, { status: 404 }),
      ),
    );

    const { queryClient, wrapper } = makeWrapper();
    const skill = makeStoredSkill({ id: SKILL_ID, isFavorited: false, favoriteCount: 1 });
    queryClient.setQueryData(['stored-skill', SKILL_ID], skill);
    queryClient.setQueryData(['stored-skills'], {
      skills: [skill],
      total: 1,
      page: 1,
      perPage: 50,
      hasMore: false,
    });

    const { result } = renderHook(() => useToggleStoredSkillFavorite(SKILL_ID), { wrapper });

    await expect(result.current.mutateAsync({ favorited: true })).rejects.toThrow();
    await waitForMutationsIdle(queryClient);

    expect(queryClient.getQueryData(['stored-skill', SKILL_ID])).toEqual(skill);
    expect(queryClient.getQueryData(['stored-skills'])).toEqual({
      skills: [skill],
      total: 1,
      page: 1,
      perPage: 50,
      hasMore: false,
    });
  });
});
