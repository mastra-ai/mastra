// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { useVisibilityChange } from '../use-visibility-change-skill';
import type { SkillEditFormValues } from '@/domains/agent-builder/hooks/use-autosave-skill';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const SKILL_ID = 'skill-vc';

const makeWrapper = (defaultVisibility: SkillEditFormValues['visibility'] = 'private') => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return function Wrapper({ children }: { children: ReactNode }) {
    const methods = useForm<SkillEditFormValues>({
      defaultValues: {
        name: '',
        description: '',
        instructions: '',
        visibility: defaultVisibility,
        workspaceId: undefined,
      },
    });
    return (
      <MastraReactProvider baseUrl={BASE_URL}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <TooltipProvider>
              <FormProvider {...methods}>
                {children}
                <span data-testid="form-visibility">{methods.watch('visibility')}</span>
                <span data-testid="form-dirty">{methods.formState.isDirty ? 'true' : 'false'}</span>
              </FormProvider>
            </TooltipProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </MastraReactProvider>
    );
  };
};

describe('useVisibilityChange (skill)', () => {
  afterEach(() => {
    cleanup();
  });

  it('cancel path: opens the dialog, closes on cancel, and never PATCHes', async () => {
    let patchCalled = false;
    server.use(
      http.patch(`${BASE_URL}/api/stored/skills/${SKILL_ID}`, () => {
        patchCalled = true;
        return HttpResponse.json({ id: SKILL_ID, visibility: 'public' });
      }),
    );

    function Harness() {
      const { requestChange, dialog } = useVisibilityChange(SKILL_ID);
      return (
        <>
          <button data-testid="trigger-add" onClick={() => requestChange('public')}>
            add
          </button>
          {dialog}
        </>
      );
    }

    const Wrapper = makeWrapper('private');
    render(
      <Wrapper>
        <Harness />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('trigger-add'));
    expect(await screen.findByTestId('skill-builder-visibility-confirm-dialog')).toBeTruthy();

    fireEvent.click(await screen.findByTestId('skill-builder-visibility-confirm-cancel'));

    await waitFor(() => {
      expect(screen.queryByTestId('skill-builder-visibility-confirm-dialog')).toBeNull();
    });
    expect(patchCalled).toBe(false);
  });

  it('confirm path: issues exactly one PATCH and writes the form value without marking it dirty', async () => {
    let callCount = 0;
    let capturedBody: any = null;
    server.use(
      http.patch(`${BASE_URL}/api/stored/skills/${SKILL_ID}`, async ({ request }) => {
        callCount += 1;
        capturedBody = await request.json();
        return HttpResponse.json({ id: SKILL_ID, visibility: 'public' });
      }),
    );

    const Wrapper = makeWrapper('private');

    // Use a tiny in-render harness that hosts both the hook and an Add button,
    // since renderHook does not let us click the dialog buttons inside the
    // same React tree as the hook owner.
    function Harness() {
      const { requestChange, dialog } = useVisibilityChange(SKILL_ID);
      return (
        <>
          <button data-testid="trigger-add" onClick={() => requestChange('public')}>
            add
          </button>
          {dialog}
        </>
      );
    }

    render(
      <Wrapper>
        <Harness />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('trigger-add'));
    await act(async () => {
      fireEvent.click(await screen.findByTestId('skill-builder-visibility-confirm-yes'));
    });

    await waitFor(() => {
      expect(callCount).toBe(1);
    });
    expect(capturedBody).toMatchObject({ visibility: 'public' });

    await waitFor(() => {
      expect(screen.getByTestId('form-visibility').textContent).toBe('public');
    });
    // The hook intentionally sets the form value with shouldDirty: false so
    // autosave does not re-fire its own PATCH after a visibility change.
    expect(screen.getByTestId('form-dirty').textContent).toBe('false');
  });
});
