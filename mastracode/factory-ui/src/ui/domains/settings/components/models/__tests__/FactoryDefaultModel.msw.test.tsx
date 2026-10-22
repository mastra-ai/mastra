import { Field } from '@mastra/playground-ui/components/Field';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { PathParams } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../../e2e/ui/render';
import type { AvailableModelOption } from '../../../../../../hooks/useAvailableModels';
import type { ApplyFactoryDefaultModelResult } from '../../../../workspaces/services/github';
import { FactoryDefaultModel } from '../FactoryDefaultModel';

const renderInField = () =>
  renderWithProviders(
    <Field>
      <FactoryDefaultModel factoryId="fp-1" />
    </Field>,
  );

if (typeof globalThis.Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const FACTORY_URL = `${TEST_BASE_URL}/web/factory/projects/fp-1`;

const models: AvailableModelOption[] = [
  { id: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', modelName: 'claude-sonnet-4-5', hasApiKey: true },
  { id: 'openai/gpt-5', provider: 'openai', modelName: 'gpt-5', hasApiKey: true },
];

const applyResult: ApplyFactoryDefaultModelResult = {
  modelId: 'openai/gpt-5',
  applied: ['thread-1', 'thread-2'],
  skipped: [{ threadId: 'thread-3', reason: 'apply-failed' }],
};

function stubFactory(defaultModelId: string | null) {
  const patchedBodies: unknown[] = [];
  const applyRequests: string[] = [];
  let saved = defaultModelId;
  server.use(
    http.get(`${TEST_BASE_URL}/web/config/models`, ({ request }) => {
      expect(new URL(request.url).searchParams.get('factoryId')).toBe('fp-1');
      return HttpResponse.json({ models });
    }),
    http.get(FACTORY_URL, () => HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra', defaultModelId: saved } })),
    http.patch<PathParams, { defaultModelId: string | null }>(FACTORY_URL, async ({ request }) => {
      const body = await request.json();
      patchedBodies.push(body);
      saved = body.defaultModelId;
      return HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra', defaultModelId: saved } });
    }),
    http.post(`${FACTORY_URL}/apply-default-model`, () => {
      applyRequests.push('apply');
      return HttpResponse.json(applyResult);
    }),
  );
  return { patchedBodies, applyRequests };
}

const SWITCH_PROMPT = /Also switch running sessions to/;

async function pickModel(user: UserEvent, modelId: string) {
  const picker = await screen.findByRole('combobox', { name: 'Factory default model' });
  await waitFor(() => expect(picker).toBeEnabled());
  await user.click(picker);
  const option = await screen.findByRole('option', { name: new RegExp(modelId.replace('/', '\\/')) });
  fireEvent.pointerDown(option, { pointerType: 'mouse' });
  fireEvent.click(option, { detail: 1 });
  return picker;
}

describe('FactoryDefaultModel', () => {
  it('offers the Factory catalog with no way to clear the default', async () => {
    stubFactory('anthropic/claude-sonnet-4-5');
    const user = userEvent.setup();
    renderInField();

    const picker = await screen.findByRole('combobox', { name: 'Factory default model' });
    await waitFor(() => expect(picker).toHaveValue('Claude Sonnet 4.5'));
    await user.click(picker);

    const options = await screen.findAllByRole('option');
    expect(options.map(option => option.textContent)).toEqual([
      expect.stringContaining('anthropic/claude-sonnet-4-5'),
      expect.stringContaining('openai/gpt-5'),
    ]);
  });

  it('saves the new default before asking whether to switch running sessions', async () => {
    const { patchedBodies, applyRequests } = stubFactory('anthropic/claude-sonnet-4-5');
    const user = userEvent.setup();
    const { client } = renderInField();

    const picker = await pickModel(user, 'openai/gpt-5');

    expect(await screen.findByRole('dialog', { name: 'Also switch running sessions to GPT-5?' })).toBeInTheDocument();
    expect(patchedBodies).toEqual([{ defaultModelId: 'openai/gpt-5' }]);
    expect(picker).toHaveValue('GPT-5');

    await user.click(screen.getByRole('button', { name: 'Keep them as-is' }));
    await waitForMutationsIdle(client);

    expect(screen.queryByRole('dialog', { name: SWITCH_PROMPT })).not.toBeInTheDocument();
    expect(applyRequests).toEqual([]);
  });

  it('keeps the dialog open while switching and reports the result', async () => {
    let releaseApply = () => {};
    const applyGate = new Promise<void>(resolve => (releaseApply = resolve));
    const { applyRequests } = stubFactory('anthropic/claude-sonnet-4-5');
    server.use(
      http.post(`${FACTORY_URL}/apply-default-model`, async () => {
        applyRequests.push('apply');
        await applyGate;
        return HttpResponse.json(applyResult);
      }),
    );
    const user = userEvent.setup();
    const { client } = renderInField();

    await pickModel(user, 'openai/gpt-5');
    const switchSessions = await screen.findByRole('button', { name: 'Switch running sessions' });
    await user.click(switchSessions);

    await waitFor(() => expect(applyRequests).toEqual(['apply']));
    expect(screen.getByRole('dialog', { name: SWITCH_PROMPT })).toBeInTheDocument();
    expect(switchSessions).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Keep them as-is' })).toBeDisabled();

    releaseApply();
    await waitForMutationsIdle(client);

    expect(screen.queryByRole('dialog', { name: SWITCH_PROMPT })).not.toBeInTheDocument();
    expect(screen.getByText(/Switched 2 sessions/)).toHaveTextContent('1 skipped: apply failed (1)');
  });

  it('does not save or ask when the picked model is already the default', async () => {
    const { patchedBodies, applyRequests } = stubFactory('anthropic/claude-sonnet-4-5');
    const user = userEvent.setup();
    renderInField();

    await pickModel(user, 'anthropic/claude-sonnet-4-5');

    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    expect(patchedBodies).toEqual([]);
    expect(applyRequests).toEqual([]);
    expect(screen.queryByRole('dialog', { name: SWITCH_PROMPT })).not.toBeInTheDocument();
  });

  it('shows a saving spinner and disables the picker while the default saves', async () => {
    let releasePatch = () => {};
    const patchGate = new Promise<void>(resolve => (releasePatch = resolve));
    stubFactory('anthropic/claude-sonnet-4-5');
    server.use(
      http.patch(FACTORY_URL, async () => {
        await patchGate;
        return HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra', defaultModelId: 'openai/gpt-5' } });
      }),
    );
    const user = userEvent.setup();
    renderInField();

    const picker = await pickModel(user, 'openai/gpt-5');

    expect(await screen.findByLabelText('Saving default model')).toBeInTheDocument();
    expect(picker).toBeDisabled();
    expect(screen.queryByRole('dialog', { name: SWITCH_PROMPT })).not.toBeInTheDocument();

    releasePatch();

    expect(await screen.findByRole('dialog', { name: SWITCH_PROMPT })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByLabelText('Saving default model')).not.toBeInTheDocument());
    expect(picker).toHaveValue('GPT-5');
  });
});
