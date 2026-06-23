import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { beforeEach, describe, expect, it } from 'vitest';

import type { SkillEditFormValues } from '../use-autosave-skill';
import { useAutosaveSkill } from '../use-autosave-skill';
import type { AuthCapabilities } from '@/domains/auth/types';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const SKILL_ID = 'autosave-skill';

// `useUpdateSkill` reads `usePermissions` to decide whether to write workspace
// files. With auth disabled there is no RBAC, so the form values above (which
// omit `workspaceId`) never trigger a workspace write — we only need the
// capabilities endpoint answered so the real permissions query resolves.
const authDisabled: AuthCapabilities = { enabled: false, login: null };

const baseFormValues: SkillEditFormValues = {
  name: 'Skill',
  description: 'Desc',
  instructions: 'Body',
  visibility: 'public',
  workspaceId: undefined,
};

const renderAutosave = ({
  defaultValues = baseFormValues,
  debounceMs = 50,
  savedDisplayMs = 30,
}: {
  defaultValues?: SkillEditFormValues;
  debounceMs?: number;
  savedDisplayMs?: number;
} = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const formRef: { current: ReturnType<typeof useForm<SkillEditFormValues>> | null } = { current: null };

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    const methods = useForm<SkillEditFormValues>({ defaultValues });
    formRef.current = methods;
    return (
      <MastraReactProvider baseUrl={BASE_URL}>
        <QueryClientProvider client={queryClient}>
          <FormProvider {...methods}>{children}</FormProvider>
        </QueryClientProvider>
      </MastraReactProvider>
    );
  };

  const view = renderHook(() => useAutosaveSkill({ skillId: SKILL_ID, debounceMs, savedDisplayMs }), {
    wrapper: Wrapper,
  });

  return { ...view, form: () => formRef.current! };
};

describe('useAutosaveSkill', () => {
  beforeEach(() => {
    server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authDisabled)));
  });

  describe('when retry triggers a save with the current form values', () => {
    it('regenerates the SKILL.md file tree and PATCHes the stored skill', async () => {
      let body: any = null;
      server.use(
        http.patch(`${BASE_URL}/api/stored/skills/${SKILL_ID}`, async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({ id: SKILL_ID, status: 'active', name: 'Skill' });
        }),
      );

      const { result } = renderAutosave();

      await act(async () => {
        result.current.retry();
      });

      await waitFor(() => expect(result.current.status).toBe('saved'));
      expect(body).toMatchObject({ name: 'Skill', files: expect.any(Object) });
    });

    it('returns to idle after the saved-status display window elapses', async () => {
      server.use(
        http.patch(`${BASE_URL}/api/stored/skills/${SKILL_ID}`, () =>
          HttpResponse.json({ id: SKILL_ID, status: 'active', name: 'Skill' }),
        ),
      );

      const { result } = renderAutosave({ savedDisplayMs: 20 });

      await act(async () => {
        result.current.retry();
      });

      await waitFor(() => expect(result.current.status).toBe('saved'));
      await waitFor(() => expect(result.current.status).toBe('idle'));
    });
  });

  describe('when the save request fails', () => {
    it('exposes the error and keeps the status in error', async () => {
      server.use(
        http.patch(`${BASE_URL}/api/stored/skills/${SKILL_ID}`, () =>
          HttpResponse.json({ message: 'nope' }, { status: 500 }),
        ),
      );

      const { result } = renderAutosave();

      await act(async () => {
        result.current.retry();
      });

      await waitFor(() => expect(result.current.status).toBe('error'));
      expect(result.current.lastError).toBeInstanceOf(Error);
    });
  });
});
