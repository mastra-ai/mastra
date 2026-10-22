import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import type { OMConfigInfo } from '../../../../../api/types';
import { MemorySettings } from '../MemorySettings';

const OM_URL = `${TEST_BASE_URL}/web/config/om`;

const omConfig = (observationThreshold: number): OMConfigInfo => ({
  observer: {
    model: 'openai/gpt-5',
    effectiveModelId: 'openai/gpt-5',
    effectiveModelSource: 'explicit',
    providerStatus: 'available',
  },
  reflector: {
    model: 'openai/gpt-5',
    effectiveModelId: 'openai/gpt-5',
    effectiveModelSource: 'explicit',
    providerStatus: 'available',
  },
  observerModelId: 'openai/gpt-5',
  reflectorModelId: 'openai/gpt-5',
  observationThreshold,
  reflectionThreshold: 40_000,
  observeAttachments: 'auto',
});

function stubProviders(providers: Array<{ provider: string; source: string }>) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/config/providers`, () => HttpResponse.json({ providers })),
    http.get(`${TEST_BASE_URL}/web/config/custom-providers`, () => HttpResponse.json({ providers: [] })),
  );
}

function renderMemory() {
  return renderWithProviders(
    <MemoryRouter>
      <MemorySettings factoryId="fp-1" sessionId="session-1" />
    </MemoryRouter>,
  );
}

describe('MemorySettings', () => {
  it('keeps personal and Factory memory on separate configs', async () => {
    let factoryWrite: unknown;
    stubProviders([{ provider: 'openai', source: 'stored' }]);
    server.use(
      http.get(OM_URL, ({ request }) => {
        const params = new URL(request.url).searchParams;
        return HttpResponse.json({ config: omConfig(params.get('factoryId') === 'fp-1' ? 50_000 : 10_000) });
      }),
      http.put(`${OM_URL}/thresholds`, async ({ request }) => {
        factoryWrite = await request.json();
        return HttpResponse.json({ ok: true, config: omConfig(60_000) });
      }),
    );
    const user = userEvent.setup();
    renderMemory();

    const personal = screen.getByRole('region', { name: 'Personal memory' });
    const factory = screen.getByRole('region', { name: 'Factory memory' });
    expect(personal).toHaveTextContent('Used by Chats');
    expect(factory).toHaveTextContent('Used by Work-item runs');
    expect(await within(personal).findByDisplayValue('10,000')).toBeInTheDocument();
    const factoryThreshold = await within(factory).findByRole('textbox', { name: 'Messages before observation' });
    expect(factoryThreshold).toHaveValue('50,000');

    await user.clear(factoryThreshold);
    await user.type(factoryThreshold, '60000');
    await user.tab();

    await waitFor(() => expect(factoryWrite).toEqual({ factoryId: 'fp-1', observationThreshold: 60_000 }));
    expect(within(personal).getByDisplayValue('10,000')).toBeInTheDocument();
  });

  it('points to Models settings while no provider is connected', async () => {
    stubProviders([{ provider: 'openai', source: 'none' }]);
    renderMemory();

    expect(await screen.findByRole('heading', { name: 'No models configured' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Models settings' })).toHaveAttribute(
      'href',
      '/factories/fp-1/settings/models',
    );
  });
});
