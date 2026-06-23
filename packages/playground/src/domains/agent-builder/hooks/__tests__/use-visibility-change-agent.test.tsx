// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AgentBuilderEditFormValues } from '../../schemas';
import { useVisibilityChange } from '../use-visibility-change-agent';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'agent-vc';

const makeWrapper = (defaultVisibility: NonNullable<AgentBuilderEditFormValues['visibility']> = 'public') => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return function Wrapper({ children }: { children: ReactNode }) {
    const methods = useForm<AgentBuilderEditFormValues>({
      defaultValues: { name: 'Agent', instructions: '', visibility: defaultVisibility },
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

function Harness({ next }: { next: 'public' | 'private' }) {
  const { requestChange, dialog } = useVisibilityChange(AGENT_ID);
  return (
    <>
      <button data-testid="trigger" onClick={() => requestChange(next)}>
        change
      </button>
      {dialog}
    </>
  );
}

describe('useVisibilityChange (agent)', () => {
  beforeEach(() => {
    // `useVisibilityChange` always loads dependents on mount (the make-private
    // dialog needs them); default to an empty set so the dialog/PATCH cases
    // don't trip the `onUnhandledRequest: 'error'` guard. The make-private
    // case overrides this with its own dependents fixture.
    server.use(
      http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/dependents`, () =>
        HttpResponse.json({ dependents: [], hiddenCount: 0 }),
      ),
    );
  });

  afterEach(() => {
    cleanup();
  });

  describe('when the user opens the dialog and cancels', () => {
    it('closes the dialog without issuing a PATCH', async () => {
      let patchCalled = false;
      server.use(
        http.patch(`${BASE_URL}/api/stored/agents/${AGENT_ID}`, () => {
          patchCalled = true;
          return HttpResponse.json({ id: AGENT_ID, visibility: 'public' });
        }),
      );

      const Wrapper = makeWrapper('private');
      render(
        <Wrapper>
          <Harness next="public" />
        </Wrapper>,
      );

      fireEvent.click(screen.getByTestId('trigger'));
      expect(await screen.findByTestId('agent-builder-visibility-confirm-dialog')).toBeTruthy();

      fireEvent.click(await screen.findByTestId('agent-builder-visibility-confirm-cancel'));

      await waitFor(() => {
        expect(screen.queryByTestId('agent-builder-visibility-confirm-dialog')).toBeNull();
      });
      expect(patchCalled).toBe(false);
    });
  });

  describe('when the user confirms making the agent public', () => {
    it('issues exactly one PATCH and writes the form value without marking it dirty', async () => {
      let callCount = 0;
      let capturedBody: any = null;
      server.use(
        http.patch(`${BASE_URL}/api/stored/agents/${AGENT_ID}`, async ({ request }) => {
          callCount += 1;
          capturedBody = await request.json();
          return HttpResponse.json({ id: AGENT_ID, visibility: 'public' });
        }),
      );

      const Wrapper = makeWrapper('private');
      render(
        <Wrapper>
          <Harness next="public" />
        </Wrapper>,
      );

      fireEvent.click(screen.getByTestId('trigger'));
      await act(async () => {
        fireEvent.click(await screen.findByTestId('agent-builder-visibility-confirm-yes'));
      });

      await waitFor(() => expect(callCount).toBe(1));
      expect(capturedBody).toMatchObject({ visibility: 'public' });

      await waitFor(() => {
        expect(screen.getByTestId('form-visibility').textContent).toBe('public');
      });
      expect(screen.getByTestId('form-dirty').textContent).toBe('false');
    });
  });

  describe('when the user opens the make-private dialog for an agent with dependents', () => {
    it('warns about the dependent agents that may break', async () => {
      server.use(
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/dependents`, () =>
          HttpResponse.json({
            dependents: [
              { id: 'dep-1', name: 'Router Agent' },
              { id: 'dep-2', name: 'Support Agent' },
            ],
            hiddenCount: 0,
          }),
        ),
        http.patch(`${BASE_URL}/api/stored/agents/${AGENT_ID}`, () =>
          HttpResponse.json({ id: AGENT_ID, visibility: 'private' }),
        ),
      );

      const Wrapper = makeWrapper('public');
      render(
        <Wrapper>
          <Harness next="private" />
        </Wrapper>,
      );

      fireEvent.click(screen.getByTestId('trigger'));

      expect(await screen.findByTestId('agent-impact-dependents-warning')).toBeTruthy();
      const dependents = await screen.findAllByTestId('agent-impact-dependent');
      expect(dependents.map(el => el.textContent)).toEqual(['Router Agent', 'Support Agent']);
    });
  });
});
