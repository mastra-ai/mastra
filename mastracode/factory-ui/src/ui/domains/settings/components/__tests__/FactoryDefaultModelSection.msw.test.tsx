import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import type { AvailableModelOption } from '../../../../../hooks/useAvailableModels';
import { FactoryDefaultModelSection } from '../FactoryDefaultModelSection';

const models: AvailableModelOption[] = [
  { id: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', modelName: 'claude-sonnet-4-5', hasApiKey: true },
  { id: 'openai/gpt-5', provider: 'openai', modelName: 'gpt-5', hasApiKey: true },
];

function renderSection() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/factories/fp-1/settings/models']}>
      <Routes>
        <Route path="/factories/:factoryId/settings/models" element={<FactoryDefaultModelSection models={models} />} />
      </Routes>
    </MemoryRouter>,
  );
}

function stubProject(
  defaultModelId: string | null,
  applyResult = {
    modelId: 'openai/gpt-5',
    applied: ['thread-1', 'thread-2'],
    skipped: [{ threadId: 'thread-3', reason: 'not-running' }],
  },
) {
  const patchedBodies: unknown[] = [];
  const postRequests: string[] = [];
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
    http.post(`${TEST_BASE_URL}/web/factory/projects/fp-1/apply-default-model`, () => {
      postRequests.push('apply');
      return HttpResponse.json(applyResult);
    }),
  );
  return { patchedBodies, postRequests };
}

async function pickModel(user: ReturnType<typeof userEvent.setup>, modelId: string) {
  const combobox = screen.getByRole('combobox');
  await waitFor(() => expect(combobox).toBeEnabled());
  await user.click(combobox);
  const option = await screen.findByRole('option', { name: new RegExp(modelId.replace('/', '\\/')) });
  fireEvent.pointerDown(option, { pointerType: 'mouse' });
  fireEvent.click(option, { detail: 1 });
  return combobox;
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

  it('saves the new default before asking whether to switch running sessions', async () => {
    const { patchedBodies, postRequests } = stubProject('anthropic/claude-sonnet-4-5');
    const user = userEvent.setup();
    const { client } = renderSection();

    const combobox = await pickModel(user, 'openai/gpt-5');

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('Also switch running sessions to openai/gpt-5?')).toBeInTheDocument();
    expect(patchedBodies).toEqual([{ defaultModelId: 'openai/gpt-5' }]);
    expect(combobox).toHaveTextContent('openai/gpt-5');

    await user.click(screen.getByRole('button', { name: 'Keep them as-is' }));
    await waitForMutationsIdle(client);

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(postRequests).toEqual([]);
  });

  it('keeps the dialog open while switching and renders the result', async () => {
    let releasePost!: () => void;
    const postGate = new Promise<void>(resolve => {
      releasePost = resolve;
    });
    const { postRequests } = stubProject('anthropic/claude-sonnet-4-5');
    server.use(
      http.post(`${TEST_BASE_URL}/web/factory/projects/fp-1/apply-default-model`, async () => {
        postRequests.push('apply');
        await postGate;
        return HttpResponse.json({
          modelId: 'openai/gpt-5',
          applied: ['thread-1', 'thread-2'],
          skipped: [{ threadId: 'thread-3', reason: 'not-running' }],
        });
      }),
    );
    const user = userEvent.setup();
    const { client } = renderSection();

    await pickModel(user, 'openai/gpt-5');
    const action = await screen.findByRole('button', { name: 'Switch running sessions' });
    await user.click(action);

    await waitFor(() => expect(postRequests).toEqual(['apply']));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(action).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Keep them as-is' })).toBeDisabled();

    releasePost();
    await waitForMutationsIdle(client);

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText(/Switched 2 sessions/)).toHaveTextContent('1 skipped: not running (1)');
  });

  it('does not save or open the dialog when the selected model is already the default', async () => {
    const { patchedBodies, postRequests } = stubProject('anthropic/claude-sonnet-4-5');
    const user = userEvent.setup();

    renderSection();
    await pickModel(user, 'anthropic/claude-sonnet-4-5');

    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    expect(patchedBodies).toEqual([]);
    expect(postRequests).toEqual([]);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('shows a saving spinner and disables the picker while the default is saving', async () => {
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

    const combobox = await pickModel(user, 'openai/gpt-5');

    expect(await screen.findByLabelText('Saving default model')).toBeInTheDocument();
    expect(combobox).toBeDisabled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    releasePatch();

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByLabelText('Saving default model')).not.toBeInTheDocument());
    expect(combobox).toHaveTextContent('openai/gpt-5');
  });
});
