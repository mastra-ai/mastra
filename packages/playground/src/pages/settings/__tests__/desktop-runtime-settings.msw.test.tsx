// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { DesktopRuntimeSettingsSection } from '../desktop-runtime-settings';
import type { DesktopRuntimeState } from '@/lib/desktop-runtime';
import { server } from '@/test/msw-server';

const desktopRuntimeState: DesktopRuntimeState = {
  runtime: {
    state: 'running',
    url: 'http://127.0.0.1:4112',
  },
  settings: {
    environmentVariables: {
      OPENAI_API_KEY: 'test-key',
    },
    modelApiKey: 'not-needed',
    modelId: 'lmstudio/openai/gpt-oss-20b',
    modelUrl: 'http://localhost:1234/v1',
  },
};

function renderDesktopRuntimeSettings() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <DesktopRuntimeSettingsSection />
    </QueryClientProvider>,
  );
}

function createDeferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>(nextResolve => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

afterEach(() => {
  delete window.MASTRA_DESKTOP_ENDPOINT;
  cleanup();
});

describe('DesktopRuntimeSettingsSection', () => {
  describe('when the Studio is served by Mastra Studio Desktop', () => {
    it('renders the local runtime controls from the desktop state endpoint', async () => {
      window.MASTRA_DESKTOP_ENDPOINT = '/__desktop';
      const probeRequests: unknown[] = [];
      server.use(
        http.get('*/__desktop/state', () => HttpResponse.json(desktopRuntimeState)),
        http.post('*/__desktop/probe-models', async ({ request }) => {
          probeRequests.push(await request.json());
          return HttpResponse.json({
            ok: true,
            modelUrl: 'http://localhost:1234/v1',
            models: ['loaded-local-model'],
          });
        }),
      );

      renderDesktopRuntimeSettings();

      expect(await screen.findByText('Runtime running on http://127.0.0.1:4112')).not.toBeNull();
      expect(screen.getByText('Desktop Runtime')).not.toBeNull();
      expect(screen.getByText('LM Studio')).not.toBeNull();
      expect((await screen.findAllByText('loaded-local-model')).length).toBeGreaterThan(0);
      expect(screen.getByText('Runtime environment')).not.toBeNull();
      expect(screen.queryByText('Add provider keys for the bundled runtime.')).toBeNull();
      expect(screen.getByDisplayValue('OPENAI_API_KEY')).not.toBeNull();
      expect(screen.queryByRole('button', { name: 'Apply & restart' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Restart runtime' })).toBeNull();
      expect(await screen.findByRole('button', { name: 'Use LM Studio' })).not.toBeNull();
      expect(probeRequests).toEqual([
        {
          apiKey: 'not-needed',
          modelUrl: 'http://localhost:1234/v1',
          providerId: 'lmstudio',
          providerName: 'LM Studio',
        },
      ]);
    });
  });

  describe('when the local model probe fails', () => {
    it('keeps the configured model editable without presenting it as a detected model option', async () => {
      window.MASTRA_DESKTOP_ENDPOINT = '/__desktop';
      server.use(
        http.get('*/__desktop/state', () => HttpResponse.json(desktopRuntimeState)),
        http.post('*/__desktop/probe-models', () =>
          HttpResponse.json({
            ok: false,
            modelUrl: 'http://localhost:1234/v1',
            models: [],
            error: 'fetch failed',
          }),
        ),
      );

      renderDesktopRuntimeSettings();

      expect(await screen.findByText('Not reachable')).not.toBeNull();
      expect(screen.getByDisplayValue('lmstudio/openai/gpt-oss-20b').tagName).toBe('INPUT');
      expect(screen.queryByRole('combobox')).toBeNull();
    });
  });

  describe('when the runtime environment changes outside the form', () => {
    it('refreshes the editor rows from the desktop state endpoint', async () => {
      window.MASTRA_DESKTOP_ENDPOINT = '/__desktop';
      let stateResponse: DesktopRuntimeState = desktopRuntimeState;
      server.use(
        http.get('*/__desktop/state', () => HttpResponse.json(stateResponse)),
        http.post('*/__desktop/probe-models', () =>
          HttpResponse.json({
            ok: true,
            modelUrl: 'http://localhost:1234/v1',
            models: ['loaded-local-model'],
          }),
        ),
      );

      renderDesktopRuntimeSettings();

      expect(await screen.findByDisplayValue('OPENAI_API_KEY')).not.toBeNull();

      stateResponse = {
        ...desktopRuntimeState,
        settings: {
          ...desktopRuntimeState.settings,
          environmentVariables: {
            ANTHROPIC_API_KEY: 'refreshed-key',
          },
        },
      };
      fireEvent.click(screen.getByRole('button', { name: 'Refresh env' }));

      expect(await screen.findByDisplayValue('ANTHROPIC_API_KEY')).not.toBeNull();
      expect(screen.getByDisplayValue('refreshed-key')).not.toBeNull();
      await waitFor(() => expect(screen.queryByDisplayValue('OPENAI_API_KEY')).toBeNull());
    });
  });

  describe('when saving the runtime environment restarts the local runtime', () => {
    it('exits the saving state after the environment is persisted', async () => {
      window.MASTRA_DESKTOP_ENDPOINT = '/__desktop';
      const restartGate = createDeferred();
      const settingsRequests: unknown[] = [];
      let restartRequests = 0;
      server.use(
        http.get('*/__desktop/state', () => HttpResponse.json(desktopRuntimeState)),
        http.post('*/__desktop/probe-models', () =>
          HttpResponse.json({
            ok: true,
            modelUrl: 'http://localhost:1234/v1',
            models: ['loaded-local-model'],
          }),
        ),
        http.patch('*/__desktop/settings', async ({ request }) => {
          const body = await request.json();
          settingsRequests.push(body);
          return HttpResponse.json({
            settings: {
              ...desktopRuntimeState.settings,
              environmentVariables: {
                ANTHROPIC_API_KEY: 'saved-key',
              },
            },
            state: {
              ...desktopRuntimeState,
              settings: {
                ...desktopRuntimeState.settings,
                environmentVariables: {
                  ANTHROPIC_API_KEY: 'saved-key',
                },
              },
            },
          });
        }),
        http.post('*/__desktop/restart-runtime', async () => {
          restartRequests += 1;
          await restartGate.promise;
          return HttpResponse.json({
            ...desktopRuntimeState,
            settings: {
              ...desktopRuntimeState.settings,
              environmentVariables: {
                ANTHROPIC_API_KEY: 'saved-key',
              },
            },
          });
        }),
      );

      renderDesktopRuntimeSettings();

      fireEvent.change(await screen.findByDisplayValue('OPENAI_API_KEY'), {
        target: { value: 'ANTHROPIC_API_KEY' },
      });
      fireEvent.change(screen.getByDisplayValue('test-key'), {
        target: { value: 'saved-key' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save runtime env' }));

      await waitFor(() =>
        expect(settingsRequests).toEqual([
          {
            environmentVariables: {
              ANTHROPIC_API_KEY: 'saved-key',
            },
          },
        ]),
      );
      expect(await screen.findByRole('button', { name: 'Save runtime env' })).not.toBeNull();
      expect(screen.queryByText('Saving...')).toBeNull();
      expect(await screen.findByDisplayValue('ANTHROPIC_API_KEY')).not.toBeNull();
      expect(screen.getByDisplayValue('saved-key')).not.toBeNull();
      expect(restartRequests).toBe(1);

      restartGate.resolve();
    });
  });

  describe('when the Studio is not served by Mastra Studio Desktop', () => {
    it('does not render desktop-only controls', () => {
      renderDesktopRuntimeSettings();

      expect(screen.queryByText('Desktop Runtime')).toBeNull();
    });
  });
});
