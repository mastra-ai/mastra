import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import type { VoiceSettingsResponse } from '../../../../../api/types';
import { VoiceInputSettings } from '../VoiceInputSettings';

const SETTINGS_URL = `${TEST_BASE_URL}/web/voice/settings`;

const MODELS: VoiceSettingsResponse['models'] = [
  { provider: 'openai', model: 'whisper-1', label: 'OpenAI Whisper', available: true },
  { provider: 'mistral', model: 'voxtral-mini-latest', label: 'Mistral Voxtral Mini', available: true },
  { provider: 'deepgram', model: 'nova-3', label: 'Deepgram Nova 3', available: false },
];

describe('VoiceInputSettings', () => {
  it('saves the picked transcription model and only offers models the user has a key for', async () => {
    let saved: unknown;
    server.use(
      http.get(SETTINGS_URL, () => HttpResponse.json({ selected: null, models: MODELS })),
      http.put(SETTINGS_URL, async ({ request }) => {
        saved = await request.json();
        return HttpResponse.json({ selected: { provider: 'mistral', model: 'voxtral-mini-latest' }, models: MODELS });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<VoiceInputSettings />);

    const picker = await screen.findByRole('combobox', { name: 'Transcription model' });
    await waitFor(() => expect(picker).toBeEnabled());
    expect(picker).toHaveTextContent('Auto');

    await user.click(picker);
    const voxtral = await screen.findByRole('option', { name: 'Mistral Voxtral Mini' });
    expect(screen.queryByRole('option', { name: /Deepgram/ })).not.toBeInTheDocument();
    await user.click(voxtral);

    await waitFor(() => expect(saved).toEqual({ provider: 'mistral', model: 'voxtral-mini-latest' }));
    await waitFor(() => expect(picker).toHaveTextContent('Mistral Voxtral Mini'));
  });

  it('goes back to auto', async () => {
    let saved: unknown;
    server.use(
      http.get(SETTINGS_URL, () =>
        HttpResponse.json({ selected: { provider: 'openai', model: 'whisper-1' }, models: MODELS }),
      ),
      http.put(SETTINGS_URL, async ({ request }) => {
        saved = await request.json();
        return HttpResponse.json({ selected: null, models: MODELS });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<VoiceInputSettings />);

    const picker = await screen.findByRole('combobox', { name: 'Transcription model' });
    await waitFor(() => expect(picker).toHaveTextContent('OpenAI Whisper'));

    await user.click(picker);
    await user.click(await screen.findByRole('option', { name: 'Auto' }));

    await waitFor(() => expect(saved).toEqual({ provider: null }));
    await waitFor(() => expect(picker).toHaveTextContent('Auto'));
  });

  it('keeps a saved model whose key was removed visible, flagged as missing a key', async () => {
    server.use(
      http.get(SETTINGS_URL, () =>
        HttpResponse.json({ selected: { provider: 'deepgram', model: 'nova-3' }, models: MODELS }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<VoiceInputSettings />);

    const picker = await screen.findByRole('combobox', { name: 'Transcription model' });
    await waitFor(() => expect(picker).toHaveTextContent('Deepgram Nova 3'));
    await user.click(picker);
    expect(await screen.findByRole('option', { name: 'Deepgram Nova 3 (no key)' })).toBeInTheDocument();
  });

  it('explains how to unlock voice input when no speech-to-text key exists', async () => {
    server.use(
      http.get(SETTINGS_URL, () =>
        HttpResponse.json({ selected: null, models: MODELS.map(m => ({ ...m, available: false })) }),
      ),
    );
    renderWithProviders(<VoiceInputSettings />);

    expect(await screen.findByText(/No speech-to-text key yet/)).toBeInTheDocument();
  });
});
