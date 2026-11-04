import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
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
      { provider: 'openai', envVar: 'OPENAI_API_KEY', user: true, org: true },
      { provider: 'mistral', envVar: 'MISTRAL_API_KEY', user: true, org: false },
      { provider: 'deepgram', envVar: 'DEEPGRAM_API_KEY', user: false, org: false },
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

function renderVoiceSettings() {
  return renderWithProviders(
    <MemoryRouter>
      <VoiceInputSettings factoryId={FACTORY_ID} />
    </MemoryRouter>,
  );
}

describe('VoiceInputSettings', () => {
  it('lets an admin pick the Factory model from models the organization has a key for', async () => {
    const { requested, saved } = stubSettings(settings(), () =>
      settings({ factory: { provider: 'openai', model: 'whisper-1' } }),
    );
    const user = userEvent.setup();
    renderVoiceSettings();

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
    renderVoiceSettings();

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
    renderVoiceSettings();

    const picker = await screen.findByRole('combobox', { name: 'Factory voice model' });
    expect(picker).toBeDisabled();
    expect(screen.getByText('Only organization admins can change the Factory model')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Your voice model' })).toBeEnabled();
  });

  it('hides the personal choice when the Factory bills every run to the organization', async () => {
    stubSettings(settings({ modelScope: 'factory' }));
    renderVoiceSettings();

    await screen.findByRole('combobox', { name: 'Factory voice model' });
    expect(screen.queryByRole('combobox', { name: 'Your voice model' })).not.toBeInTheDocument();
    expect(screen.getByText('This Factory transcribes with organization keys')).toBeInTheDocument();
  });

  it('keeps a saved model whose key was removed visible, flagged as missing a key', async () => {
    stubSettings(settings({ personal: { provider: 'deepgram', model: 'nova-3' }, effective: null }));
    const user = userEvent.setup();
    renderVoiceSettings();

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
              { provider: 'openai', envVar: 'OPENAI_API_KEY', user: true, org: true },
              { provider: 'mistral', envVar: 'MISTRAL_API_KEY', user: true, org: false },
              { provider: 'deepgram', envVar: 'DEEPGRAM_API_KEY', user: hasDeepgram, org: false },
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
    renderVoiceSettings();

    await user.click(await screen.findByRole('button', { name: 'Add provider' }));
    await user.click(await screen.findByRole('button', { name: 'Add API key for Deepgram' }));
    await user.type(await screen.findByPlaceholderText('Paste API key'), 'dg-secret');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(keys).toEqual([{ provider: 'deepgram', body: { key: 'dg-secret', envVar: 'DEEPGRAM_API_KEY' } }]),
    );
    expect(await screen.findByRole('button', { name: 'Deepgram actions' })).toBeInTheDocument();
  });

  it('offers no model to pick until a speech-to-text key exists', async () => {
    stubSettings(
      settings({
        modelScope: 'user',
        effective: null,
        models: MODELS.map(m => ({ ...m, available: false })),
        keys: [
          { provider: 'openai', envVar: 'OPENAI_API_KEY', user: false, org: false },
          { provider: 'mistral', envVar: 'MISTRAL_API_KEY', user: false, org: false },
          { provider: 'deepgram', envVar: 'DEEPGRAM_API_KEY', user: false, org: false },
        ],
      }),
    );
    renderVoiceSettings();

    expect(await screen.findByRole('combobox', { name: 'Factory voice model' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Your voice model' })).toBeDisabled();
    expect(screen.getAllByText('Add a speech-to-text key below to pick a model')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /actions$/ })).not.toBeInTheDocument();
  });
});
