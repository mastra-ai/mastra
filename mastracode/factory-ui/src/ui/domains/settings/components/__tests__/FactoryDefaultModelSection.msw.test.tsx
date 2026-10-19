import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { PathParams } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import type { AvailableModelOption } from '../../../../../hooks/useAvailableModels';
import type { ApplyFactoryDefaultModelResult } from '../../../workspaces/services/github';
import { FactoryDefaultModelSection } from '../FactoryDefaultModelSection';

if (typeof globalThis.Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const FACTORY_URL = `${TEST_BASE_URL}/web/factory/projects/fp-1`;

const models: AvailableModelOption[] = [
  { id: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', modelName: 'claude-sonnet-4-5', hasApiKey: true },
  {
    id: 'openai/gpt-5',
    provider: 'openai',
    modelName: 'gpt-5',
    hasApiKey: true,
    reasoningOptions: [{ type: 'effort', values: ['minimal', 'low', 'medium', 'high'] }],
  },
];

function renderSection() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/factories/fp-1/settings/models']}>
      <Routes>
        <Route path="/factories/:factoryId/settings/models" element={<FactoryDefaultModelSection models={models} />} />
      </Routes>
      <Toaster position="bottom-right" />
    </MemoryRouter>,
  );
}

function stubProject(
  defaultModelId: string | null,
  applyResult: ApplyFactoryDefaultModelResult = {
    modelId: 'openai/gpt-5',
    applied: ['thread-1', 'thread-2'],
    skipped: [{ threadId: 'thread-3', reason: 'apply-failed' }],
  },
) {
  const patchedBodies: unknown[] = [];
  const postRequests: string[] = [];
  let saved = defaultModelId;
  server.use(
    http.get(FACTORY_URL, () => HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra', defaultModelId: saved } })),
    http.patch<PathParams, { defaultModelId: string | null }>(FACTORY_URL, async ({ request }) => {
      const body = await request.json();
      patchedBodies.push(body);
      saved = body.defaultModelId;
      return HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra', defaultModelId: saved } });
    }),
    http.post(`${FACTORY_URL}/apply-default-model`, () => {
      postRequests.push('apply');
      return HttpResponse.json(applyResult);
    }),
  );
  return { patchedBodies, postRequests };
}

function modelTrigger() {
  return screen.getByRole('combobox', { name: 'Factory default model' });
}

async function pickModel(user: UserEvent, modelId: string) {
  const trigger = modelTrigger();
  await waitFor(() => expect(trigger).toBeEnabled());
  await user.click(trigger);
  const option = await screen.findByRole('option', { name: new RegExp(modelId.replace('/', '\\/')) });
  fireEvent.pointerDown(option, { pointerType: 'mouse' });
  fireEvent.click(option, { detail: 1 });
  return trigger;
}

describe('FactoryDefaultModelSection model', () => {
  it('stays available in a hybrid Factory and says it drives work items', async () => {
    server.use(
      http.get(FACTORY_URL, () =>
        HttpResponse.json({
          project: { id: 'fp-1', name: 'Mastra', defaultModelId: 'openai/gpt-5', modelScope: 'hybrid' },
        }),
      ),
    );

    renderSection();

    expect(
      await screen.findByText(
        "Work items (triage, board runs) start on this model and run on organization credentials. Interactive sessions start on each owner's personal default instead.",
      ),
    ).toBeInTheDocument();
    const trigger = modelTrigger();
    await waitFor(() => expect(trigger).toBeEnabled());
    expect(trigger).toHaveTextContent('GPT-5');
  });

  it('keeps the Factory-run copy outside hybrid scope', async () => {
    stubProject('openai/gpt-5');

    renderSection();

    expect(
      await screen.findByText(
        "Factory runs (triage, board work items) start on this model and use the Factory memory settings. Your personal defaults don't apply to them.",
      ),
    ).toBeInTheDocument();
  });

  it('shows the saved default model and offers no way to clear it', async () => {
    stubProject('anthropic/claude-sonnet-4-5');
    const user = userEvent.setup();

    renderSection();

    const trigger = modelTrigger();
    await waitFor(() => expect(trigger).toBeEnabled());
    expect(trigger).toHaveTextContent('Claude Sonnet 4.5');

    await user.click(trigger);
    const options = await screen.findAllByRole('option');
    expect(options.map(option => option.textContent)).toEqual([
      expect.stringContaining('anthropic/claude-sonnet-4-5'),
      expect.stringContaining('openai/gpt-5'),
    ]);
  });

  it('saves the new default before asking whether to switch running sessions', async () => {
    const { patchedBodies, postRequests } = stubProject('anthropic/claude-sonnet-4-5');
    const user = userEvent.setup();
    const { client } = renderSection();

    const trigger = await pickModel(user, 'openai/gpt-5');

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('Also switch running sessions to GPT-5?')).toBeInTheDocument();
    expect(patchedBodies).toEqual([{ defaultModelId: 'openai/gpt-5' }]);
    expect(trigger).toHaveTextContent('GPT-5');

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
      http.post(`${FACTORY_URL}/apply-default-model`, async () => {
        postRequests.push('apply');
        await postGate;
        return HttpResponse.json({
          modelId: 'openai/gpt-5',
          applied: ['thread-1', 'thread-2'],
          skipped: [{ threadId: 'thread-3', reason: 'apply-failed' }],
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
    expect(screen.getByText(/Switched 2 sessions/)).toHaveTextContent('1 skipped: apply failed (1)');
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
      http.get(FACTORY_URL, () =>
        HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra', defaultModelId: 'anthropic/claude-sonnet-4-5' } }),
      ),
      http.patch(FACTORY_URL, async () => {
        await patchGate;
        return HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra', defaultModelId: 'openai/gpt-5' } });
      }),
    );
    const user = userEvent.setup();

    renderSection();

    const trigger = await pickModel(user, 'openai/gpt-5');

    expect(await screen.findByLabelText('Saving default model')).toBeInTheDocument();
    expect(trigger).toBeDisabled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    releasePatch();

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByLabelText('Saving default model')).not.toBeInTheDocument());
    expect(trigger).toHaveTextContent('GPT-5');
  });
});

describe('FactoryDefaultModelSection thinking', () => {
  const factory = { id: 'fp-1', name: 'Mastra', defaultThinkingLevel: 'off' };
  const saved = (defaultThinkingLevel: string) => HttpResponse.json({ project: { ...factory, defaultThinkingLevel } });

  async function openRamp(user: UserEvent, triggerName: string) {
    await user.click(await screen.findByRole('button', { name: triggerName }));
    return screen.getByRole('slider', { name: 'Thinking' });
  }

  const dragTo = (slider: HTMLElement, level: number) => fireEvent.change(slider, { target: { value: String(level) } });

  it('renders the Factory thinking level from the server', async () => {
    server.use(http.get(FACTORY_URL, () => HttpResponse.json({ project: factory })));

    renderSection();

    expect(await screen.findByRole('button', { name: 'Thinking: Off' })).toBeEnabled();
  });

  it('shows medium for a Factory without a stored level', async () => {
    server.use(http.get(FACTORY_URL, () => HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra' } })));

    renderSection();

    expect(await screen.findByRole('button', { name: 'Thinking: Medium' })).toBeEnabled();
  });

  it('offers every level and shows the stored one, whatever the default model runs', async () => {
    const patches: unknown[] = [];
    server.use(
      http.get(FACTORY_URL, () =>
        HttpResponse.json({ project: { ...factory, defaultModelId: 'openai/gpt-5', defaultThinkingLevel: 'max' } }),
      ),
      http.patch(FACTORY_URL, async ({ request }) => {
        patches.push(await request.json());
        return saved('max');
      }),
    );
    const user = userEvent.setup();

    const { client } = renderSection();

    const ramp = await openRamp(user, 'Thinking: Max');
    expect(ramp).toHaveAttribute('aria-valuetext', 'Max');
    expect(ramp).toHaveAttribute('max', '5');
    fireEvent.blur(ramp);

    await waitForMutationsIdle(client);
    expect(patches).toEqual([]);
  });

  it('saves once, the level the drag ended on', async () => {
    const requestBodies: unknown[] = [];
    server.use(
      http.get(FACTORY_URL, () => HttpResponse.json({ project: factory })),
      http.patch(FACTORY_URL, async ({ request }) => {
        requestBodies.push(await request.json());
        return saved('high');
      }),
    );
    const user = userEvent.setup();

    const { client } = renderSection();

    const ramp = await openRamp(user, 'Thinking: Off');
    dragTo(ramp, 5);
    dragTo(ramp, 3);
    fireEvent.pointerUp(ramp);
    fireEvent.blur(ramp);

    await waitForMutationsIdle(client);
    expect(requestBodies).toEqual([{ defaultThinkingLevel: 'high' }]);
    await waitFor(() => expect(ramp).toHaveAttribute('aria-valuetext', 'High'));
  });

  it('does not resend a level whose write is still in flight', async () => {
    let writes = 0;
    let releaseSecondWrite = () => {};
    const secondWrite = new Promise<void>(resolve => (releaseSecondWrite = resolve));
    server.use(
      http.get(FACTORY_URL, () => HttpResponse.json({ project: factory })),
      http.patch(FACTORY_URL, async () => {
        writes += 1;
        if (writes === 2) await secondWrite;
        return saved(writes === 1 ? 'high' : 'max');
      }),
    );
    const user = userEvent.setup();

    const { client } = renderSection();

    const ramp = await openRamp(user, 'Thinking: Off');
    dragTo(ramp, 3);
    fireEvent.pointerUp(ramp);
    dragTo(ramp, 5);
    fireEvent.pointerUp(ramp);

    await waitFor(() => expect(writes).toBe(2));
    fireEvent.blur(ramp);
    releaseSecondWrite();

    await waitForMutationsIdle(client);
    expect(writes).toBe(2);
    await waitFor(() => expect(ramp).toHaveAttribute('aria-valuetext', 'Max'));
  });

  it('keeps a repeated level on screen until its own write lands', async () => {
    let writes = 0;
    let releaseFirstWrite = () => {};
    let releaseThirdWrite = () => {};
    const firstWrite = new Promise<void>(resolve => (releaseFirstWrite = resolve));
    const thirdWrite = new Promise<void>(resolve => (releaseThirdWrite = resolve));
    server.use(
      http.get(FACTORY_URL, () => HttpResponse.json({ project: factory })),
      http.patch(FACTORY_URL, async () => {
        writes += 1;
        const write = writes;
        if (write === 1) await firstWrite;
        if (write === 3) await thirdWrite;
        return saved(write === 2 ? 'max' : 'high');
      }),
    );
    const user = userEvent.setup();

    const { client } = renderSection();

    const ramp = await openRamp(user, 'Thinking: Off');
    dragTo(ramp, 3);
    fireEvent.pointerUp(ramp);
    dragTo(ramp, 5);
    fireEvent.pointerUp(ramp);
    dragTo(ramp, 3);
    fireEvent.pointerUp(ramp);

    await waitFor(() => expect(writes).toBe(1));
    releaseFirstWrite();

    await waitFor(() => expect(writes).toBe(3));
    expect(ramp).toHaveAttribute('aria-valuetext', 'High');

    releaseThirdWrite();
    await waitForMutationsIdle(client);
    expect(ramp).toHaveAttribute('aria-valuetext', 'High');
  });

  it('tells a member that only admins can change it', async () => {
    server.use(
      http.get(FACTORY_URL, () => HttpResponse.json({ project: factory })),
      http.patch(FACTORY_URL, () =>
        HttpResponse.json(
          {
            error: 'forbidden',
            message: 'Organization administrator access is required to change the thinking default.',
          },
          { status: 403 },
        ),
      ),
    );
    const user = userEvent.setup();

    const { client } = renderSection();

    const ramp = await openRamp(user, 'Thinking: Off');
    dragTo(ramp, 3);
    fireEvent.pointerUp(ramp);

    await waitForMutationsIdle(client);
    expect(await screen.findByText('Only organization admins can change the thinking level')).toBeInTheDocument();
    await waitFor(() => expect(ramp).toHaveAttribute('aria-valuetext', 'Off'));
  });
});
