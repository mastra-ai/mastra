import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../e2e/ui/render';
import type { VoiceSettingsResponse } from '../../../../../../api/types';
import { VoiceInputSettings } from '../VoiceInputSettings';

const SETTINGS_URL = `${TEST_BASE_URL}/web/voice/settings`;
const PROVIDERS_URL = `${TEST_BASE_URL}/web/config/providers`;
const FACTORY_ID = 'factory-1';

const MODELS: VoiceSettingsResponse['models'] = [
  { provider: 'openai', model: 'whisper-1', label: 'OpenAI Whisper', available: true },
  { provider: 'mistral', model: 'voxtral-mini-latest', label: 'Mistral Voxtral Mini', available: true },
  { provider: 'deepgram', model: 'nova-3', label: 'Deepgram Nova 3', available: false },
];

function settings(overrides: Partial<VoiceSettingsResponse> = {}): VoiceSettingsResponse {
  return {
    modelScope: 'hybrid',
    personal: null,
    factory: null,
    canEditFactory: true,
    effective: { provider: 'openai', model: 'whisper-1' },
    models: MODELS,
    keys: [
      { provider: 'openai', user: true, org: true },
      { provider: 'mistral', user: true, org: false },
      { provider: 'deepgram', user: false, org: false },
    ],
    ...overrides,
  };
}

function stubSettings(initial: VoiceSettingsResponse, onPut?: (body: unknown) => VoiceSettingsResponse) {
  const requested: string[] = [];
  const saved: unknown[] = [];
  let current = initial;
  server.use(
    http.get(PROVIDERS_URL, () => HttpResponse.json({ orgKeyAdmin: true, providers: [] })),
    http.get(SETTINGS_URL, ({ request }) => {
      requested.push(new URL(request.url).searchParams.get('factoryId') ?? '');
      return HttpResponse.json(current);
    }),
    http.put(SETTINGS_URL, async ({ request }) => {
      const body = await request.json();
      saved.push(body);
      if (onPut) current = onPut(body);
      return HttpResponse.json(current);
    }),
  );
  return { requested, saved };
}

describe('VoiceInputSettings', () => {
  it('lets an admin pick the Factory model from models the organization has a key for', async () => {
    const { requested, saved } = stubSettings(settings(), () =>
      settings({ factory: { provider: 'openai', model: 'whisper-1' } }),
    );
    const user = userEvent.setup();
    renderWithProviders(<VoiceInputSettings factoryId={FACTORY_ID} />);

    const picker = await screen.findByRole('combobox', { name: 'Factory voice model' });
    expect(requested[0]).toBe(FACTORY_ID);
    expect(picker).toHaveTextContent('Auto');

    await user.click(picker);
    const whisper = await screen.findByRole('option', { name: 'OpenAI Whisper' });
    // Hybrid Factory runs fall back to organization keys, and only OpenAI has one.
    expect(screen.queryByRole('option', { name: /Voxtral/ })).not.toBeInTheDocument();
    await user.click(whisper);

    await waitFor(() =>
      expect(saved).toEqual([{ target: 'factory', factoryId: FACTORY_ID, provider: 'openai', model: 'whisper-1' }]),
    );
    await waitFor(() => expect(picker).toHaveTextContent('OpenAI Whisper'));
  });

  it('saves a personal override and can go back to following the Factory', async () => {
    const { saved } = stubSettings(settings({ factory: { provider: 'openai', model: 'whisper-1' } }), body =>
      settings({
        factory: { provider: 'openai', model: 'whisper-1' },
        personal: (body as { provider: string | null }).provider
          ? { provider: 'mistral', model: 'voxtral-mini-latest' }
          : null,
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<VoiceInputSettings factoryId={FACTORY_ID} />);

    const picker = await screen.findByRole('combobox', { name: 'Your voice model' });
    expect(picker).toHaveTextContent("Use Factory's (OpenAI Whisper)");

    await user.click(picker);
    await user.click(await screen.findByRole('option', { name: 'Mistral Voxtral Mini' }));
    await waitFor(() => expect(picker).toHaveTextContent('Mistral Voxtral Mini'));

    await user.click(picker);
    await user.click(await screen.findByRole('option', { name: "Use Factory's (OpenAI Whisper)" }));

    await waitFor(() =>
      expect(saved).toEqual([
        { target: 'personal', factoryId: FACTORY_ID, provider: 'mistral', model: 'voxtral-mini-latest' },
        { target: 'personal', factoryId: FACTORY_ID, provider: null },
      ]),
    );
  });

  it('keeps the Factory model read-only for members who are not org admins', async () => {
    stubSettings(settings({ canEditFactory: false }));
    renderWithProviders(<VoiceInputSettings factoryId={FACTORY_ID} />);

    const picker = await screen.findByRole('combobox', { name: 'Factory voice model' });
    expect(picker).toBeDisabled();
    expect(screen.getByText('Only organization admins can change the Factory model')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Your voice model' })).toBeEnabled();
  });

  it('hides the personal choice when the Factory bills every run to the organization', async () => {
    stubSettings(settings({ modelScope: 'factory' }));
    renderWithProviders(<VoiceInputSettings factoryId={FACTORY_ID} />);

    await screen.findByRole('combobox', { name: 'Factory voice model' });
    expect(screen.queryByRole('combobox', { name: 'Your voice model' })).not.toBeInTheDocument();
    expect(screen.getByText('This Factory transcribes with organization keys')).toBeInTheDocument();
  });

  it('keeps a saved model whose key was removed visible, flagged as missing a key', async () => {
    stubSettings(settings({ personal: { provider: 'deepgram', model: 'nova-3' }, effective: null }));
    const user = userEvent.setup();
    renderWithProviders(<VoiceInputSettings factoryId={FACTORY_ID} />);

    const picker = await screen.findByRole('combobox', { name: 'Your voice model' });
    expect(picker).toHaveTextContent('Deepgram Nova 3');
    expect(screen.getByText('No speech-to-text key yet')).toBeInTheDocument();
    await user.click(picker);
    expect(await screen.findByRole('option', { name: 'Deepgram Nova 3 (no key)' })).toBeInTheDocument();
  });

  it('adds a Deepgram key from the voice section and refreshes which models are usable', async () => {
    const keys: Array<{ provider: string; body: unknown }> = [];
    let hasDeepgram = false;
    stubSettings(settings());
    server.use(
      http.get(SETTINGS_URL, () =>
        HttpResponse.json(
          settings({
            keys: [
              { provider: 'openai', user: true, org: true },
              { provider: 'mistral', user: true, org: false },
              { provider: 'deepgram', user: hasDeepgram, org: false },
            ],
          }),
        ),
      ),
      http.put(`${PROVIDERS_URL}/:provider/key`, async ({ request, params }) => {
        keys.push({ provider: String(params.provider), body: await request.json() });
        hasDeepgram = true;
        return HttpResponse.json({ ok: true });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<VoiceInputSettings factoryId={FACTORY_ID} />);

    await user.click(await screen.findByRole('button', { name: 'Add Deepgram key' }));
    await user.type(await screen.findByPlaceholderText('Paste API key'), 'dg-secret');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(keys).toEqual([{ provider: 'deepgram', body: { key: 'dg-secret', envVar: 'DEEPGRAM_API_KEY' } }]),
    );
    expect(await screen.findByRole('button', { name: 'Replace Deepgram key' })).toBeInTheDocument();
  });
});
