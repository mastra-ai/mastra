import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import type { OMConfigInfo } from '../../../../../api/types';
import type { AvailableModelOption } from '../../../../../hooks/useAvailableModels';
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
  observer: {
    model: 'openai/observer-x',
    effectiveModelId: 'openai/observer-x',
    effectiveModelSource: 'explicit',
    providerStatus: 'available',
  },
  reflector: {
    model: 'openai/reflector-x',
    effectiveModelId: 'openai/reflector-x',
    effectiveModelSource: 'explicit',
    providerStatus: 'available',
  },
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

    expect(await screen.findByDisplayValue('1,000')).toBeInTheDocument();
    expect(screen.queryByText('Model credentials required')).not.toBeInTheDocument();
    expect(requested).toBe(true);
  });

  it('keeps OM enabled and warns when a configured model is unavailable', async () => {
    server.use(
      http.get(OM_URL, () =>
        HttpResponse.json({
          config: {
            ...baseConfig,
            reflector: {
              model: 'google/gemini-3.5-flash',
              effectiveModelId: 'google/gemini-3.5-flash',
              effectiveModelSource: 'explicit',
              providerStatus: 'unavailable',
            },
            reflectorModelId: 'google/gemini-3.5-flash',
          },
        }),
      ),
    );

    renderWithProviders(<OMSection models={models} />);

    expect(await screen.findByText('Model credentials required')).toBeInTheDocument();
    expect(screen.getByText(/model calls may fail until credentials are configured/)).toBeInTheDocument();
    expect(screen.queryByText('Enabled')).not.toBeInTheDocument();
    // A configured model that is no longer in the catalog still shows, by name.
    expect(screen.getByRole('combobox', { name: 'Observer model' })).toHaveValue('Observer X');
    expect(screen.getByRole('combobox', { name: 'Reflector model' })).toHaveValue('Gemini 3.5 Flash');
  });

  it('displays auto intent with its effective model and resets one role independently', async () => {
    let requestBody: unknown;
    const autoConfig: OMConfigInfo = {
      ...baseConfig,
      observer: {
        model: 'auto',
        effectiveModelId: 'openai/gpt-5.4-mini',
        effectiveModelSource: 'configured-default',
        providerStatus: 'available',
      },
      observerModelId: 'openai/gpt-5.4-mini',
    };
    server.use(
      http.get(OM_URL, () => HttpResponse.json({ config: autoConfig })),
      http.put(`${OM_URL}/reflector/model`, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({
          ok: true,
          config: {
            ...autoConfig,
            reflector: {
              model: 'auto',
              effectiveModelId: 'openai/gpt-5.4-mini',
              effectiveModelSource: 'configured-default',
              providerStatus: 'available',
            },
            reflectorModelId: 'openai/gpt-5.4-mini',
          },
        });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<OMSection models={models} />);

    await screen.findByDisplayValue('1,000');
    const observerTrigger = screen.getByRole('combobox', { name: 'Observer model' });
    const reflectorTrigger = screen.getByRole('combobox', { name: 'Reflector model' });
    expect(observerTrigger).toHaveValue('Auto · GPT-5.4 Mini');
    expect(reflectorTrigger).toHaveValue('Reflector X');

    await pickOption(user, reflectorTrigger, /^Auto/);

    await waitFor(() => expect(requestBody).toEqual({ modelId: 'auto' }));
    await waitFor(() => expect(reflectorTrigger).toHaveValue('Auto · GPT-5.4 Mini'));
    expect(observerTrigger).toHaveValue('Auto · GPT-5.4 Mini');
  });

  it('finds a model by its provider and raw id as well as its name', async () => {
    server.use(http.get(OM_URL, () => HttpResponse.json({ config: baseConfig })));

    const user = userEvent.setup();
    renderWithProviders(
      <OMSection
        models={[
          ...models,
          { id: 'anthropic/claude-haiku-4-5', provider: 'anthropic', modelName: 'claude-haiku-4-5', hasApiKey: true },
        ]}
      />,
    );

    // The field itself is the search box: it holds the selected model's name until cleared.
    const search = await screen.findByRole('combobox', { name: 'Observer model' });
    await user.clear(search);
    await user.type(search, 'anthropic');
    // The custom-value row stays first; the only catalog match is the Anthropic model.
    await waitFor(() =>
      expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([
        'Use “anthropic”',
        'Claude Haiku 4.5anthropic/claude-haiku-4-5',
      ]),
    );

    await user.clear(search);
    await user.type(search, 'claude-haiku');
    expect(await screen.findByRole('option', { name: /Claude Haiku 4\.5/ })).toBeInTheDocument();
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
    expect(await screen.findByDisplayValue('1,000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2,000')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Observer model' })).toHaveValue('Observer X');
    expect(screen.getByRole('combobox', { name: 'Reflector model' })).toHaveValue('Reflector X');
    expect(screen.getByRole('radio', { name: 'Auto' })).toHaveAttribute('aria-checked', 'true');
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

    const input = await screen.findByRole('textbox', { name: 'Messages before observation' });
    expect(input).toHaveValue('1,000');
    await user.clear(input);
    await user.type(input, '5000');
    await user.tab();

    await waitFor(() => expect(requestBody).toEqual({ observationThreshold: 5000 }));
    expect(await screen.findByDisplayValue('5,000')).toBeInTheDocument();
  });

  it('steps a threshold by a thousand tokens and saves when the stepper is released', async () => {
    const requests: unknown[] = [];
    server.use(
      http.get(OM_URL, () => HttpResponse.json({ config: baseConfig })),
      http.put(`${OM_URL}/thresholds`, async ({ request }) => {
        const body = (await request.json()) as { reflectionThreshold: number };
        requests.push(body);
        return HttpResponse.json({ ok: true, config: { ...baseConfig, ...body } });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<OMSection models={models} />);

    const input = await screen.findByRole('textbox', { name: 'Observations before reflection' });
    expect(input).toHaveValue('2,000');
    const row = input.closest<HTMLElement>('[data-slot=input-number-group]');
    if (!row) throw new Error('Expected the threshold stepper group');
    await user.click(within(row).getByRole('button', { name: 'Increase' }));

    await waitFor(() => expect(requests).toEqual([{ reflectionThreshold: 3000 }]));
    await waitFor(() => expect(input).toHaveValue('3,000'));
  });

  it('keeps what is being typed when an earlier save lands, then saves it', async () => {
    const requests: unknown[] = [];
    let releaseFirstSave: () => void = () => {};
    const firstSaveHeld = new Promise<void>(resolve => {
      releaseFirstSave = resolve;
    });
    server.use(
      http.get(OM_URL, () => HttpResponse.json({ config: baseConfig })),
      http.put(`${OM_URL}/thresholds`, async ({ request }) => {
        const body = (await request.json()) as { observationThreshold: number };
        requests.push(body);
        if (requests.length === 1) await firstSaveHeld;
        return HttpResponse.json({ ok: true, config: { ...baseConfig, ...body } });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<OMSection models={models} />);

    const input = await screen.findByRole('textbox', { name: 'Messages before observation' });
    await user.clear(input);
    await user.type(input, '2000');
    await user.tab();
    await waitFor(() => expect(requests).toEqual([{ observationThreshold: 2000 }]));

    // Back in the field before the first save has answered.
    await user.clear(input);
    await user.type(input, '3000');
    // The model pickers lock while any save is pending, so their unlocking marks the first save landing.
    expect(screen.getByRole('combobox', { name: 'Observer model' })).toBeDisabled();
    releaseFirstSave();
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Observer model' })).toBeEnabled());
    expect(input).toHaveValue('3000');

    await user.click(document.body);
    await waitFor(() => expect(requests).toEqual([{ observationThreshold: 2000 }, { observationThreshold: 3000 }]));
    await waitFor(() => expect(input).toHaveValue('3,000'));
  });

  it('keeps the saved threshold when the field is cleared', async () => {
    let requested = false;
    server.use(
      http.get(OM_URL, () => HttpResponse.json({ config: baseConfig })),
      http.put(`${OM_URL}/thresholds`, () => {
        requested = true;
        return HttpResponse.json({ ok: true, config: baseConfig });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<OMSection models={models} />);

    const input = await screen.findByRole('textbox', { name: 'Messages before observation' });
    await user.clear(input);
    await user.tab();

    await waitFor(() => expect(input).toHaveValue('1,000'));
    expect(requested).toBe(false);
  });

  it('updates the observer model', async () => {
    let requestBody: unknown;
    server.use(
      http.get(OM_URL, () => HttpResponse.json({ config: baseConfig })),
      http.put(`${OM_URL}/observer/model`, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({
          ok: true,
          config: {
            ...baseConfig,
            observer: {
              model: 'openai/reflector-x',
              effectiveModelId: 'openai/reflector-x',
              providerStatus: 'available',
            },
            observerModelId: 'openai/reflector-x',
          },
        });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<OMSection models={models} />);

    const observerTrigger = await screen.findByRole('combobox', { name: 'Observer model' });
    expect(observerTrigger).toHaveValue('Observer X');
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

    await screen.findByDisplayValue('1,000');
    await user.click(screen.getByRole('radio', { name: 'On' }));

    await waitFor(() => expect(requestBody).toEqual({ value: true }));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'On' })).toHaveAttribute('aria-checked', 'true'));
  });
});
