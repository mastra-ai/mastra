import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StudioConnectionSettings } from '../components/studio-connection-settings';
import { authDisabledCapabilities } from '../context/__tests__/fixtures/capabilities';
import { MASTRA_STUDIO_CONFIG_LOCAL_STORAGE_KEY, StudioConfigProvider } from '../context/studio-config-context';
import type { StudioConfig } from '../types';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const config: StudioConfig = {
  baseUrl: BASE_URL,
  headers: { Authorization: 'Bearer test' },
  apiPrefix: '/mastra',
};

function storedConfig(): unknown {
  return JSON.parse(window.localStorage.getItem(MASTRA_STUDIO_CONFIG_LOCAL_STORAGE_KEY) ?? 'null');
}

const urlInput = () => screen.getByRole('textbox', { name: 'Mastra instance URL' });
const saveButton = () => screen.queryByRole('button', { name: 'Save changes' });
const type = (name: string, value: string) =>
  fireEvent.change(screen.getByRole('textbox', { name }), { target: { value } });

async function renderSettings() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <StudioConfigProvider endpoint={BASE_URL}>
        <TooltipProvider>
          <StudioConnectionSettings />
        </TooltipProvider>
      </StudioConfigProvider>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(urlInput()).toHaveProperty('value', config.baseUrl));
}

beforeEach(() => {
  server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authDisabledCapabilities)));
  window.localStorage.setItem(MASTRA_STUDIO_CONFIG_LOCAL_STORAGE_KEY, JSON.stringify(config));
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('StudioConnectionSettings', () => {
  it('shows the stored connection once it loads, without a save button', async () => {
    await renderSettings();

    expect(screen.getByRole('textbox', { name: 'API prefix' })).toHaveProperty('value', '/mastra');
    expect(screen.getByRole('textbox', { name: 'Header name' })).toHaveProperty('value', 'Authorization');
    expect(saveButton()).toBeNull();
  });

  it('saves the URL, prefix and headers together and shows the saved values', async () => {
    await renderSettings();

    type('Mastra instance URL', ' http://localhost:5000 ');
    type('API prefix', '/v2');
    fireEvent.click(screen.getByRole('button', { name: 'Add header' }));
    const [, newName] = screen.getAllByRole('textbox', { name: 'Header name' });
    fireEvent.change(newName, { target: { value: 'X-Team' } });
    type('Value of X-Team', 'design');

    expect(storedConfig()).toEqual(config);
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(storedConfig()).toMatchObject({
      baseUrl: 'http://localhost:5000',
      apiPrefix: '/v2',
      headers: { Authorization: 'Bearer test', 'X-Team': 'design' },
    });
    expect(urlInput()).toHaveProperty('value', 'http://localhost:5000');
    expect(screen.getByRole('textbox', { name: 'Value of X-Team' })).toHaveProperty('value', 'design');
    expect(saveButton()).toBeNull();
  });

  it('saves an empty prefix as the default and drops headers without a name', async () => {
    await renderSettings();

    type('API prefix', '  ');
    fireEvent.click(screen.getByRole('button', { name: 'Add header' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(storedConfig()).toMatchObject({ baseUrl: BASE_URL, headers: config.headers });
    expect(storedConfig()).not.toHaveProperty('apiPrefix');
    expect(screen.getByRole('textbox', { name: 'API prefix' })).toHaveProperty('value', '');
    expect(screen.getAllByRole('textbox', { name: 'Header name' })).toHaveLength(1);
  });

  it('removes a header on save', async () => {
    await renderSettings();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Authorization' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(storedConfig()).toMatchObject({ ...config, headers: {} });
    expect(screen.queryByRole('textbox', { name: 'Header name' })).toBeNull();
  });

  it('discards edits', async () => {
    await renderSettings();

    type('Mastra instance URL', 'http://elsewhere');
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

    expect(urlInput()).toHaveProperty('value', config.baseUrl);
    expect(saveButton()).toBeNull();
    expect(storedConfig()).toEqual(config);
  });

  it('asks for a URL instead of saving an empty one', async () => {
    await renderSettings();

    type('Mastra instance URL', '');
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(screen.getByText('Enter the server URL')).toBeTruthy();
    expect(storedConfig()).toEqual(config);
  });
});
