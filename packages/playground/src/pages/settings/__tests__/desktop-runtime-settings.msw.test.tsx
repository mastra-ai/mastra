// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { DesktopRuntimeSettingsSection } from '../desktop-runtime-settings';
import type { DesktopRuntimeState } from '../desktop-runtime-settings';
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

  describe('when the Studio is not served by Mastra Studio Desktop', () => {
    it('does not render desktop-only controls', () => {
      renderDesktopRuntimeSettings();

      expect(screen.queryByText('Desktop Runtime')).toBeNull();
    });
  });
});
