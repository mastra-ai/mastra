import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { expect } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { VoiceSettingsResponse } from '../../../../../api/types';
import { renderThread, stubPreparingSession } from './composer-session-test-fixture';

export interface TranscribeRequest {
  factoryId: string | null;
  contentType: string | null;
  clip: string;
}

export function acceptTranscribe(reply: () => Response): TranscribeRequest[] {
  const requests: TranscribeRequest[] = [];
  server.use(
    http.post(`${TEST_BASE_URL}/web/voice/transcribe`, async ({ request }) => {
      requests.push({
        factoryId: new URL(request.url).searchParams.get('factoryId'),
        contentType: request.headers.get('Content-Type'),
        clip: await request.text(),
      });
      return reply();
    }),
  );
  return requests;
}

export function answerLiveSession(reply: () => Response) {
  server.use(http.post(`${TEST_BASE_URL}/web/voice/live-session`, reply));
}

export function stubVoiceSettings(
  effective: VoiceSettingsResponse['effective'],
  selected: VoiceSettingsResponse['selected'] = null,
) {
  const response: VoiceSettingsResponse = {
    scope: 'user',
    selected,
    canEdit: true,
    effective,
    models: [],
    keys: [],
  };
  server.use(http.get(`${TEST_BASE_URL}/web/voice/settings`, () => HttpResponse.json(response)));
}

export async function composerReady() {
  stubPreparingSession({ materialized: true });
  renderThread();
  const message = await screen.findByRole('textbox', { name: 'Message' });
  await waitFor(() => expect(message).toBeEnabled());
  await waitFor(() => expect(screen.getByRole('button', { name: 'Dictate' })).toBeEnabled());
  return message;
}
