import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { AddApiKeyDialog } from '../AddApiKeyDialog';

const PROVIDERS_URL = `${TEST_BASE_URL}/web/config/providers`;

describe('AddApiKeyDialog', () => {
  it('saves a personal key when org access resolves after the dialog opens', async () => {
    const saved: unknown[] = [];
    server.use(
      http.get(PROVIDERS_URL, () => HttpResponse.json({ orgKeyAdmin: false, providers: [] })),
      http.put(`${PROVIDERS_URL}/:provider/key`, async ({ request }) => {
        saved.push(await request.json());
        return HttpResponse.json({ ok: true });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <AddApiKeyDialog
        provider={{ provider: 'openai', source: 'none' }}
        authEnabled
        defaultScope="org"
        onClose={() => {}}
      />,
    );

    await waitFor(() => expect(screen.getByRole('radio', { name: 'Just me' })).toBeChecked());
    await user.type(screen.getByPlaceholderText('Paste API key'), 'sk-personal');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(saved).toEqual([{ key: 'sk-personal', scope: 'user' }]));
  });
});
