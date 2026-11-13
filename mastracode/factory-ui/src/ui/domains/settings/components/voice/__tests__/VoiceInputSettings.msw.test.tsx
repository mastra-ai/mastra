import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../../e2e/ui/render';
import type { VoiceSettingsResponse } from '../../../../../../api/types';
import type { FactoryModelScope } from '../../../../workspaces/services/github';
import { ModelRoutingSection } from '../../models/routing/ModelRoutingSection';
import { VoiceInputSettings } from '../VoiceInputSettings';

const SETTINGS_URL = `${TEST_BASE_URL}/web/voice/settings`;
const PROVIDERS_URL = `${TEST_BASE_URL}/web/config/providers`;
const FACTORY_ID = 'factory-1';

const MODELS: VoiceSettingsResponse['models'] = [
  { provider: 'openai', model: 'whisper-1', label: 'OpenAI Whisper' },
  { provider: 'mistral', model: 'voxtral-mini-latest', label: 'Mistral Voxtral Mini' },
  { provider: 'deepgram', model: 'nova-3', label: 'Deepgram Nova 3' },
];

const ENV_VARS: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  deepgram: 'DEEPGRAM_API_KEY',
};

function keys(saved: string[]): VoiceSettingsResponse['keys'] {
  return Object.entries(ENV_VARS).map(([provider, envVar]) => ({
    provider,
    envVar,
    saved: saved.includes(provider),
    fromEnv: false,
  }));
}

function settings(overrides: Partial<VoiceSettingsResponse> = {}): VoiceSettingsResponse {
  return {
    scope: 'user',
    selected: null,
    canEdit: true,
    effective: { provider: 'mistral', model: 'voxtral-mini-latest' },
    models: MODELS,
    keys: keys(['mistral']),
    ...overrides,
  };
}

function factorySettings(overrides: Partial<VoiceSettingsResponse> = {}): VoiceSettingsResponse {
  return settings({
    scope: 'factory',
    effective: { provider: 'openai', model: 'whisper-1' },
    keys: keys(['openai']),
    ...overrides,
  });
}

type SettingsPut = { factoryId?: string } & ({ provider: null } | { provider: string; model: string });

function stubSettings(initial: VoiceSettingsResponse, onPut?: (body: SettingsPut) => VoiceSettingsResponse) {
  const requested: string[] = [];
  const saved: SettingsPut[] = [];
  let current = initial;
  server.use(
    http.get(PROVIDERS_URL, () => HttpResponse.json({ orgKeyAdmin: true, providers: [] })),
    http.get(SETTINGS_URL, ({ request }) => {
      requested.push(new URL(request.url).searchParams.get('factoryId') ?? '');
      return HttpResponse.json(current);
    }),
    http.put<never, SettingsPut>(SETTINGS_URL, async ({ request }) => {
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
  afterEach(() => {
    delete window.MASTRA_PLATFORM_PROJECT_ID;
  });

  it('presents connected Mastra Gateway as the preferred speech path', async () => {
    window.MASTRA_PLATFORM_PROJECT_ID = 'project-1';
    stubSettings(settings({ effective: null, keys: keys([]) }));
    server.use(
      http.get(`${TEST_BASE_URL}/api/system/gateway-audio/models`, () =>
        HttpResponse.json({ speech: [], transcription: [{ id: 'openai/whisper' }] }),
      ),
    );
    renderVoiceSettings();

    expect(await screen.findByText('Preferred speech-to-text connection for this deployment')).toBeInTheDocument();
    expect(screen.getByText('Connected. Choose a Gateway model beside the composer microphone.')).toBeInTheDocument();
    expect(screen.getByText('Mastra Gateway by default in the composer')).toBeInTheDocument();
  });

  it('lets an admin of a factory-scoped Factory pick the Factory model from models with an organization key', async () => {
    const { requested, saved } = stubSettings(factorySettings(), () =>
      factorySettings({ selected: { provider: 'openai', model: 'whisper-1' } }),
    );
    const user = userEvent.setup();
    renderVoiceSettings();

    const picker = await screen.findByRole('combobox', { name: 'Factory voice model' });
    expect(requested[0]).toBe(FACTORY_ID);
    expect(picker).toHaveTextContent('Auto');
    expect(screen.queryByRole('combobox', { name: 'Your voice model' })).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'OpenAI actions' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mistral actions' })).not.toBeInTheDocument();

    await user.click(picker);
    const whisper = await screen.findByRole('option', { name: 'OpenAI Whisper' });
    expect(screen.queryByRole('option', { name: /Voxtral/ })).not.toBeInTheDocument();
    await user.click(whisper);

    await waitFor(() => expect(saved).toEqual([{ factoryId: FACTORY_ID, provider: 'openai', model: 'whisper-1' }]));
    await waitFor(() => expect(picker).toHaveTextContent('OpenAI Whisper'));
  });

  it('keeps the Factory model read-only for members who are not org admins', async () => {
    stubSettings(factorySettings({ canEdit: false, selected: { provider: 'openai', model: 'whisper-1' } }));
    renderVoiceSettings();

    const picker = await screen.findByRole('combobox', { name: 'Factory voice model' });
    expect(picker).toBeDisabled();
    expect(picker).toHaveTextContent('OpenAI Whisper');
    expect(screen.getByText('Only organization admins can change the Factory model')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Your voice model' })).not.toBeInTheDocument();
  });

  it('lets a member of a personal-scoped Factory pick their own model from their personal keys and go back to auto', async () => {
    const { saved } = stubSettings(settings(), body =>
      settings({
        selected: body.provider ? { provider: 'mistral', model: 'voxtral-mini-latest' } : null,
      }),
    );
    const user = userEvent.setup();
    renderVoiceSettings();

    const picker = await screen.findByRole('combobox', { name: 'Your voice model' });
    expect(picker).toHaveTextContent('Auto');
    expect(screen.queryByRole('combobox', { name: 'Factory voice model' })).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Mistral actions' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'OpenAI actions' })).not.toBeInTheDocument();

    await user.click(picker);
    expect(screen.queryByRole('option', { name: 'OpenAI Whisper' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('option', { name: 'Mistral Voxtral Mini' }));
    await waitFor(() => expect(picker).toHaveTextContent('Mistral Voxtral Mini'));

    await user.click(picker);
    await user.click(await screen.findByRole('option', { name: 'Auto' }));

    await waitFor(() =>
      expect(saved).toEqual([
        { factoryId: FACTORY_ID, provider: 'mistral', model: 'voxtral-mini-latest' },
        { factoryId: FACTORY_ID, provider: null },
      ]),
    );
  });

  it('refetches other Factories after a personal choice, since it is shared across them', async () => {
    const { requested } = stubSettings(settings(), () =>
      settings({ selected: { provider: 'mistral', model: 'voxtral-mini-latest' } }),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter>
        <VoiceInputSettings factoryId={FACTORY_ID} />
        <VoiceInputSettings factoryId="factory-2" />
      </MemoryRouter>,
    );

    const [picker] = await screen.findAllByRole('combobox', { name: 'Your voice model' });
    await waitFor(() => expect(requested).toEqual(expect.arrayContaining([FACTORY_ID, 'factory-2'])));
    const before = requested.filter(id => id === 'factory-2').length;
    await user.click(picker);
    await user.click(await screen.findByRole('option', { name: 'Mistral Voxtral Mini' }));

    await waitFor(() => expect(requested.filter(id => id === 'factory-2').length).toBe(before + 1));
    expect(requested.filter(id => id === FACTORY_ID)).toHaveLength(1);
  });

  it('shows a Deepgram key read from the server environment without offering to update or remove it', async () => {
    stubSettings(
      settings({
        keys: keys(['mistral']).map(k => (k.provider === 'deepgram' ? { ...k, saved: true, fromEnv: true } : k)),
      }),
    );
    renderVoiceSettings();

    expect(await screen.findByText('From env')).toBeInTheDocument();
    expect(screen.getByText('Deepgram')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deepgram actions' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mistral actions' })).toBeInTheDocument();
  });

  it('shows an env key as From env even when the catalog also lists a stored key for that provider', async () => {
    stubSettings(
      settings({
        keys: keys(['mistral', 'openai']).map(k => (k.provider === 'openai' ? { ...k, fromEnv: true } : k)),
      }),
    );
    server.use(
      http.get(PROVIDERS_URL, () =>
        HttpResponse.json({
          orgKeyAdmin: true,
          providers: [{ provider: 'openai', source: 'stored', envVar: 'OPENAI_API_KEY' }],
        }),
      ),
    );
    renderVoiceSettings();

    expect(await screen.findByText('From env')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'OpenAI actions' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mistral actions' })).toBeInTheDocument();
  });

  it('keeps a saved model whose key was removed visible, flagged as missing a key', async () => {
    stubSettings(settings({ selected: { provider: 'deepgram', model: 'nova-3' }, effective: null }));
    const user = userEvent.setup();
    renderVoiceSettings();

    const picker = await screen.findByRole('combobox', { name: 'Your voice model' });
    expect(picker).toHaveTextContent('Deepgram Nova 3');
    expect(screen.getByText('Needs a Deepgram key')).toBeInTheDocument();
    await user.click(picker);
    expect(await screen.findByRole('option', { name: 'Deepgram Nova 3 (no key)' })).toBeInTheDocument();
  });

  it('adds a Deepgram key from the voice section and refreshes which models are usable', async () => {
    const savedKeys: Array<{ provider: string; body: unknown }> = [];
    let hasDeepgram = false;
    stubSettings(settings());
    server.use(
      http.get(SETTINGS_URL, () =>
        HttpResponse.json(settings({ keys: keys(hasDeepgram ? ['mistral', 'deepgram'] : ['mistral']) })),
      ),
      http.put(`${PROVIDERS_URL}/:provider/key`, async ({ request, params }) => {
        savedKeys.push({ provider: String(params.provider), body: await request.json() });
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
      expect(savedKeys).toEqual([{ provider: 'deepgram', body: { key: 'dg-secret', envVar: 'DEEPGRAM_API_KEY' } }]),
    );
    expect(await screen.findByRole('button', { name: 'Deepgram actions' })).toBeInTheDocument();
  });

  it.each([
    {
      scope: 'factory',
      picker: 'Factory voice model',
      hint: 'Add an organization speech-to-text key below to pick a model',
    },
    { scope: 'user', picker: 'Your voice model', hint: 'Add a speech-to-text key below to pick a model' },
  ] as const)(
    'offers no model to pick until the $scope side has a speech-to-text key',
    async ({ scope, picker, hint }) => {
      stubSettings(settings({ scope, effective: null, keys: keys([]) }));
      renderVoiceSettings();

      expect(await screen.findByRole('combobox', { name: picker })).toBeDisabled();
      expect(screen.getByText(hint)).toBeInTheDocument();
      expect(screen.getByText('No speech-to-text key yet')).toBeInTheDocument();
      await screen.findByRole('button', { name: 'Add provider' });
      expect(screen.queryByRole('button', { name: /actions$/ })).not.toBeInTheDocument();
    },
  );

  it('switches voice input to the Factory model when an admin moves the Factory to factory scope', async () => {
    const factoryUrl = `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}`;
    let modelScope: FactoryModelScope = 'user';
    stubSettings(settings());
    server.use(
      http.get(SETTINGS_URL, () => HttpResponse.json(modelScope === 'factory' ? factorySettings() : settings())),
      http.get(`${TEST_BASE_URL}/web/config/default-model`, () =>
        HttpResponse.json({ modelId: null, thinkingLevel: null }),
      ),
      http.get(`${TEST_BASE_URL}/web/config/models`, () => HttpResponse.json({ models: [] })),
      http.get(factoryUrl, () => HttpResponse.json({ project: { id: FACTORY_ID, name: 'Mastra', modelScope } })),
      http.patch<never, { modelScope: FactoryModelScope }>(factoryUrl, async ({ request }) => {
        modelScope = (await request.json()).modelScope;
        return HttpResponse.json({ project: { id: FACTORY_ID, name: 'Mastra', modelScope } });
      }),
    );
    const user = userEvent.setup();
    const { client } = renderWithProviders(
      <MemoryRouter>
        <ModelRoutingSection factoryId={FACTORY_ID} />
        <VoiceInputSettings factoryId={FACTORY_ID} />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('combobox', { name: 'Your voice model' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Personal' })).toBeChecked());

    await user.click(screen.getByRole('radio', { name: 'Factory' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Switch for everyone' }));
    await waitForMutationsIdle(client);

    expect(await screen.findByRole('combobox', { name: 'Factory voice model' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Your voice model' })).not.toBeInTheDocument();
  });
});
