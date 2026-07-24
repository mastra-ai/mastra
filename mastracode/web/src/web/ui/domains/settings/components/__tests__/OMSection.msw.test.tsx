import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import type { OMConfigInfo } from '../../../../../../shared/api/types';
import type { AvailableModelOption } from '../../../../../../shared/hooks/useAvailableModels';
import { OMSection } from '../OMSection';

const OM_URL = `${TEST_BASE_URL}/web/config/om`;

const models: AvailableModelOption[] = [
  { id: 'openai/observer-x', provider: 'openai', modelName: 'observer-x', hasApiKey: true },
  { id: 'openai/reflector-x', provider: 'openai', modelName: 'reflector-x', hasApiKey: true },
];

async function pickOption(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement, name: RegExp) {
  await user.click(trigger);
  const option = await screen.findByRole('option', { name });
  fireEvent.pointerDown(option, { pointerType: 'mouse' });
  fireEvent.click(option, { detail: 1 });
  await waitFor(() => expect(screen.queryByRole('option', { name })).not.toBeInTheDocument());
}

const baseConfig: OMConfigInfo = {
  observerModelId: 'openai/observer-x',
  reflectorModelId: 'openai/reflector-x',
  observationThreshold: 1000,
  reflectionThreshold: 2000,
  observeAttachments: 'auto',
};

describe('OMSection', () => {
  it('loads persisted settings without an active chat session', async () => {
    let requested = false;
    server.use(
      http.get(OM_URL, ({ request }) => {
        requested = true;
        expect(new URL(request.url).search).toBe('');
        return HttpResponse.json({ config: baseConfig });
      }),
    );

    renderWithProviders(<OMSection models={models} />);

    expect(await screen.findByDisplayValue('1000')).toBeInTheDocument();
    expect(screen.queryByText('Model credentials required')).not.toBeInTheDocument();
    expect(requested).toBe(true);
  });

  it('keeps OM enabled and warns when a configured model is unavailable', async () => {
    server.use(
      http.get(OM_URL, () =>
        HttpResponse.json({
          config: { ...baseConfig, reflectorModelId: 'google/gemini-3.5-flash' },
        }),
      ),
    );

    renderWithProviders(<OMSection models={models} />);

    expect(await screen.findByText('Model credentials required')).toBeInTheDocument();
    expect(screen.getByText(/model calls may fail until credentials are configured/)).toBeInTheDocument();
    expect(screen.queryByText('Enabled')).not.toBeInTheDocument();
    const [observerModel, reflectorModel] = screen.getAllByRole('combobox');
    expect(observerModel).toHaveTextContent('openai/observer-x');
    expect(reflectorModel).toHaveTextContent('google/gemini-3.5-flash');
  });

  it('loads the observer, reflector, thresholds, and attachment setting', async () => {
    server.use(
      http.get(OM_URL, async () => {
        await delay(50);
        return HttpResponse.json({ config: baseConfig });
      }),
    );

    renderWithProviders(<OMSection models={models} />);

    expect(await screen.findByRole('status', { name: 'Loading observational-memory settings' })).toBeInTheDocument();
    expect(await screen.findByDisplayValue('1000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2000')).toBeInTheDocument();
    expect(screen.getByText('Observer model')).toBeInTheDocument();
    expect(screen.getByText('Reflector model')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('updates an observation threshold and reflects the server response', async () => {
    let requestBody: unknown;
    server.use(
      http.get(OM_URL, () => HttpResponse.json({ config: baseConfig })),
      http.put(`${OM_URL}/thresholds`, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ ok: true, config: { ...baseConfig, observationThreshold: 5000 } });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<OMSection models={models} />);

    const input = await screen.findByDisplayValue<HTMLInputElement>('1000');
    await user.clear(input);
    await user.type(input, '5000');
    await user.tab();

    await waitFor(() => expect(requestBody).toEqual({ observationThreshold: 5000 }));
    expect(await screen.findByDisplayValue('5000')).toBeInTheDocument();
  });

  it('updates the observer model', async () => {
    let requestBody: unknown;
    server.use(
      http.get(OM_URL, () => HttpResponse.json({ config: baseConfig })),
      http.put(`${OM_URL}/observer/model`, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ ok: true, config: { ...baseConfig, observerModelId: 'openai/reflector-x' } });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<OMSection models={models} />);

    await screen.findByDisplayValue('1000');
    const [observerTrigger] = screen.getAllByRole('combobox');
    expect(observerTrigger).toBeDefined();
    await pickOption(user, observerTrigger, /openai\/reflector-x/);

    await waitFor(() => expect(requestBody).toEqual({ modelId: 'openai/reflector-x' }));
  });

  it('updates attachment observation', async () => {
    let requestBody: unknown;
    server.use(
      http.get(OM_URL, () => HttpResponse.json({ config: baseConfig })),
      http.put(`${OM_URL}/observe-attachments`, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ ok: true, config: { ...baseConfig, observeAttachments: true } });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<OMSection models={models} />);

    await screen.findByDisplayValue('1000');
    await user.click(screen.getByRole('button', { name: 'On' }));

    await waitFor(() => expect(requestBody).toEqual({ value: true }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'On' })).toHaveAttribute('aria-pressed', 'true'));
  });
});
