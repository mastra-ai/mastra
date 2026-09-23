import { ThemeProvider } from '@mastra/playground-ui/components/ThemeProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { StudioSettingsPage } from './index';
import {
  MASTRA_STUDIO_CONFIG_LOCAL_STORAGE_KEY,
  StudioConfigProvider,
} from '@/domains/configuration/context/studio-config-context';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

async function renderSettingsPage() {
  server.use(http.get(BASE_URL, () => HttpResponse.text('ok')));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={queryClient}>
      <StudioConfigProvider endpoint={BASE_URL}>
        <ThemeProvider>
          <StudioSettingsPage />
        </ThemeProvider>
      </StudioConfigProvider>
    </QueryClientProvider>,
  );

  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'Mastra instance URL' })).toHaveProperty('value', BASE_URL),
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('StudioSettingsPage', () => {
  describe('when the settings page is visited', () => {
    it('exposes the settings breadcrumb and settings controls inside the main landmark', async () => {
      await renderSettingsPage();

      expect(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByText('Settings')).toBeDefined();
      const main = within(screen.getByRole('main'));
      expect(
        within(main.getByRole('radiogroup', { name: 'Theme' }))
          .getByRole('radio', { name: 'System' })
          .getAttribute('aria-checked'),
      ).toBe('true');
      expect(main.getByRole('textbox', { name: 'Mastra instance URL' })).toHaveProperty('value', BASE_URL);
      expect(main.getByRole('textbox', { name: 'API prefix' })).toHaveProperty('value', '/api');
    });
  });

  describe('when the connection settings are edited', () => {
    it('persists the configuration submitted from the page', async () => {
      await renderSettingsPage();

      fireEvent.change(screen.getByRole('textbox', { name: 'API prefix' }), { target: { value: '/custom-api' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Configuration' }));

      expect(JSON.parse(localStorage.getItem(MASTRA_STUDIO_CONFIG_LOCAL_STORAGE_KEY) ?? '{}')).toMatchObject({
        baseUrl: BASE_URL,
        apiPrefix: '/custom-api',
        headers: {},
      });
    });
  });
});
