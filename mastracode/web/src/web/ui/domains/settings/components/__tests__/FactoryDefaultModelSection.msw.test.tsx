/**
 * BDD coverage for the Factory default model setting. The setting is
 * mandatory: the picker offers only real models (no "Session default" clear
 * option) and every pick PATCHes a concrete `defaultModelId` — there is no
 * path back to an unset model.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import type { AvailableModelOption } from '../../../../../../shared/hooks/useAvailableModels';
import { FactoryDefaultModelSection } from '../FactoryDefaultModelSection';

const models: AvailableModelOption[] = [
  { id: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', modelName: 'claude-sonnet-4-5', hasApiKey: true },
  { id: 'openai/gpt-5', provider: 'openai', modelName: 'gpt-5', hasApiKey: true },
];

function renderSection() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/factories/fp-1/settings/model']}>
      <Routes>
        <Route path="/factories/:factoryId/settings/model" element={<FactoryDefaultModelSection models={models} />} />
      </Routes>
    </MemoryRouter>,
  );
}

function stubProject(defaultModelId: string | null) {
  const patchedBodies: unknown[] = [];
  let saved = defaultModelId;
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1`, () =>
      HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra', defaultModelId: saved } }),
    ),
    http.patch(`${TEST_BASE_URL}/web/factory/projects/fp-1`, async ({ request }) => {
      const body = (await request.json()) as { defaultModelId: string | null };
      patchedBodies.push(body);
      saved = body.defaultModelId;
      return HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra', defaultModelId: saved } });
    }),
  );
  return { patchedBodies };
}

describe('FactoryDefaultModelSection', () => {
  it('shows the saved default model and offers no way to clear it', async () => {
    stubProject('anthropic/claude-sonnet-4-5');
    const user = userEvent.setup();

    renderSection();

    const combobox = screen.getByRole('combobox');
    await waitFor(() => expect(combobox).toBeEnabled());
    expect(combobox).toHaveTextContent('anthropic/claude-sonnet-4-5');

    await user.click(combobox);
    const options = await screen.findAllByRole('option');
    expect(options.map(option => option.textContent)).toEqual([
      expect.stringContaining('anthropic/claude-sonnet-4-5'),
      expect.stringContaining('openai/gpt-5'),
    ]);
    expect(screen.queryByRole('option', { name: /session default/i })).not.toBeInTheDocument();
  });

  it('saves a newly picked model with a concrete defaultModelId', async () => {
    const { patchedBodies } = stubProject('anthropic/claude-sonnet-4-5');
    const user = userEvent.setup();

    renderSection();

    const combobox = screen.getByRole('combobox');
    await waitFor(() => expect(combobox).toBeEnabled());
    await user.click(combobox);
    const option = await screen.findByRole('option', { name: /openai\/gpt-5/ });
    fireEvent.pointerDown(option, { pointerType: 'mouse' });
    fireEvent.click(option, { detail: 1 });

    await waitFor(() => expect(patchedBodies).toEqual([{ defaultModelId: 'openai/gpt-5' }]));
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveTextContent('openai/gpt-5'));
  });

  it('shows a saving spinner and disables the picker while the mutation is in flight', async () => {
    let releasePatch!: () => void;
    const patchGate = new Promise<void>(resolve => {
      releasePatch = resolve;
    });
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1`, () =>
        HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra', defaultModelId: 'anthropic/claude-sonnet-4-5' } }),
      ),
      http.patch(`${TEST_BASE_URL}/web/factory/projects/fp-1`, async () => {
        await patchGate;
        return HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra', defaultModelId: 'openai/gpt-5' } });
      }),
    );
    const user = userEvent.setup();

    renderSection();

    const combobox = screen.getByRole('combobox');
    await waitFor(() => expect(combobox).toBeEnabled());
    expect(screen.queryByLabelText('Saving default model')).not.toBeInTheDocument();

    await user.click(combobox);
    const option = await screen.findByRole('option', { name: /openai\/gpt-5/ });
    fireEvent.pointerDown(option, { pointerType: 'mouse' });
    fireEvent.click(option, { detail: 1 });

    expect(await screen.findByLabelText('Saving default model')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeDisabled();

    releasePatch();

    await waitFor(() => expect(screen.queryByLabelText('Saving default model')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveTextContent('openai/gpt-5'));
  });
});
