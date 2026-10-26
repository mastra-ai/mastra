import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import { Field } from '@mastra/playground-ui/components/Field';
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../../../e2e/ui/render';
import type { DefaultModelResponse } from '../../../../../../../api/types';
import type { AvailableModelOption } from '../../../../../../../hooks/useAvailableModels';
import { PersonalDefaultModel } from '../PersonalDefaultModel';
import { pickModel } from './default-model-test-utils';

const renderInField = () =>
  renderWithProviders(
    <>
      <Field>
        <PersonalDefaultModel />
      </Field>
      <Toaster position="bottom-right" />
    </>,
  );

const DEFAULT_MODEL_URL = `${TEST_BASE_URL}/web/config/default-model`;
const THINKING_URL = `${DEFAULT_MODEL_URL}/thinking`;
const MODELS_URL = `${TEST_BASE_URL}/web/config/models`;
const FACTORY_URL = `${TEST_BASE_URL}/web/factory/projects/fp-1`;
const UNAVAILABLE_WARNING = /None of your connected accounts can run/;
const FOLLOWING_BUILT_IN = 'Thinking: Medium · Built-in default';

const models: AvailableModelOption[] = [
  { id: 'openai/gpt-5', provider: 'openai', modelName: 'gpt-5', hasApiKey: true },
  { id: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', modelName: 'claude-sonnet-4-5', hasApiKey: true },
];

function stubPersonalCatalog(catalog: AvailableModelOption[]) {
  server.use(
    http.get(MODELS_URL, ({ request }) => {
      expect(new URL(request.url).searchParams.get('scope')).toBe('user');
      return HttpResponse.json({ models: catalog });
    }),
  );
}

async function dragThinkingTo(user: UserEvent, triggerName: string, level: number) {
  await user.click(await screen.findByRole('button', { name: triggerName }));
  const ramp = screen.getByRole('slider', { name: 'Thinking' });
  fireEvent.change(ramp, { target: { value: String(level) } });
  fireEvent.pointerUp(ramp);
}

beforeEach(() => {
  server.use(
    http.get(FACTORY_URL, () =>
      HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra', defaultThinkingLevel: 'low' } }),
    ),
  );
});

describe('PersonalDefaultModel', () => {
  it('saves a picked model as the personal default', async () => {
    let modelId: DefaultModelResponse['modelId'] = null;
    let putBody: unknown;
    stubPersonalCatalog(models);
    server.use(
      http.get(DEFAULT_MODEL_URL, () => HttpResponse.json({ modelId, thinkingLevel: null })),
      http.put(DEFAULT_MODEL_URL, async ({ request }) => {
        putBody = await request.json();
        modelId = 'anthropic/claude-sonnet-4-5';
        return HttpResponse.json({ ok: true, modelId });
      }),
    );
    const user = userEvent.setup();
    const { client } = renderInField();

    await pickModel(user, 'Personal default model', 'anthropic/claude-sonnet-4-5');
    await waitForMutationsIdle(client);

    expect(putBody).toEqual({ modelId: 'anthropic/claude-sonnet-4-5' });
    expect(screen.getByRole('combobox', { name: 'Personal default model' })).toHaveValue('Claude Sonnet 4.5');
  });

  it('applies the default to running sessions and reports the skipped ones', async () => {
    stubPersonalCatalog(models);
    server.use(
      http.get(DEFAULT_MODEL_URL, () => HttpResponse.json({ modelId: 'openai/gpt-5', thinkingLevel: null })),
      http.post(`${DEFAULT_MODEL_URL}/apply`, () =>
        HttpResponse.json({
          modelId: 'openai/gpt-5',
          applied: ['running-session'],
          skipped: [{ sessionId: 'dormant-session', reason: 'not-running' }],
        }),
      ),
    );
    const user = userEvent.setup();
    const { client } = renderInField();

    await user.click(await screen.findByRole('button', { name: 'Apply to running sessions' }));
    await waitForMutationsIdle(client);

    expect(screen.getByText(/Switched 1 session/)).toHaveTextContent('Switched 1 session. 1 skipped: not running (1)');
  });

  it('clears the personal default', async () => {
    let modelId: DefaultModelResponse['modelId'] = 'openai/gpt-5';
    stubPersonalCatalog(models);
    server.use(
      http.get(DEFAULT_MODEL_URL, () => HttpResponse.json({ modelId, thinkingLevel: null })),
      http.delete(DEFAULT_MODEL_URL, () => {
        modelId = null;
        return HttpResponse.json({ ok: true, modelId });
      }),
    );
    const user = userEvent.setup();
    const { client } = renderInField();

    await user.click(await screen.findByRole('button', { name: 'Clear' }));
    await waitForMutationsIdle(client);

    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Personal default model' })).toHaveValue('');
  });

  it('flags a saved default the personal catalog cannot run', async () => {
    stubPersonalCatalog(models);
    server.use(
      http.get(DEFAULT_MODEL_URL, () => HttpResponse.json({ modelId: 'deepseek/deepseek-flash', thinkingLevel: null })),
    );

    renderInField();

    expect(await screen.findByText(UNAVAILABLE_WARNING)).toBeInTheDocument();
  });

  it('does not flag the default while the personal catalog is unknown', async () => {
    server.use(
      http.get(MODELS_URL, () => HttpResponse.json({ error: 'unavailable' }, { status: 503 })),
      http.get(DEFAULT_MODEL_URL, () => HttpResponse.json({ modelId: 'deepseek/deepseek-flash', thinkingLevel: null })),
    );
    const { client } = renderInField();

    await screen.findByRole('combobox', { name: 'Personal default model' });
    await waitForMutationsIdle(client);

    expect(screen.queryByText(UNAVAILABLE_WARNING)).not.toBeInTheDocument();
  });

  it('does not flag a default the personal catalog offers', async () => {
    stubPersonalCatalog(models);
    server.use(http.get(DEFAULT_MODEL_URL, () => HttpResponse.json({ modelId: 'openai/gpt-5', thinkingLevel: null })));
    const user = userEvent.setup();
    renderInField();

    await user.click(await screen.findByRole('combobox', { name: 'Personal default model' }));
    expect(await screen.findByRole('option', { name: /openai\/gpt-5/ })).toBeInTheDocument();
    expect(screen.queryByText(UNAVAILABLE_WARNING)).not.toBeInTheDocument();
  });

  it('offers no personal thinking level until a personal model is picked', async () => {
    stubPersonalCatalog(models);
    server.use(http.get(DEFAULT_MODEL_URL, () => HttpResponse.json({ modelId: null, thinkingLevel: null })));

    renderInField();

    expect(
      await screen.findByRole('button', { name: 'Thinking: unavailable. Pick a personal default model first.' }),
    ).toBeInTheDocument();
  });

  it('follows the built-in level, never the Factory level, until a personal level is saved, and hands back to it', async () => {
    let thinkingLevel: DefaultModelResponse['thinkingLevel'] = null;
    const putBodies: unknown[] = [];
    stubPersonalCatalog(models);
    server.use(
      http.get(DEFAULT_MODEL_URL, () => HttpResponse.json({ modelId: 'openai/gpt-5', thinkingLevel })),
      http.put<never, { thinkingLevel: ThinkingLevelSetting | null }>(THINKING_URL, async ({ request }) => {
        const body = await request.json();
        putBodies.push(body);
        thinkingLevel = body.thinkingLevel;
        return HttpResponse.json({ ok: true, thinkingLevel });
      }),
    );
    const user = userEvent.setup();
    const { client } = renderInField();

    await user.click(await screen.findByRole('button', { name: FOLLOWING_BUILT_IN }));
    expect(screen.getByText('Follows the Built-in default.')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await dragThinkingTo(user, FOLLOWING_BUILT_IN, 3);
    await waitForMutationsIdle(client);

    expect(putBodies).toEqual([{ thinkingLevel: 'high' }]);
    expect(await screen.findByRole('button', { name: 'Thinking: High' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Use default' }));
    await waitForMutationsIdle(client);

    expect(putBodies).toEqual([{ thinkingLevel: 'high' }, { thinkingLevel: null }]);
    expect(await screen.findByRole('button', { name: FOLLOWING_BUILT_IN })).toBeInTheDocument();
  });

  it('puts the personal thinking level back when the server rejects it', async () => {
    stubPersonalCatalog(models);
    server.use(
      http.get(DEFAULT_MODEL_URL, () => HttpResponse.json({ modelId: 'openai/gpt-5', thinkingLevel: null })),
      http.put(THINKING_URL, () => HttpResponse.json({ error: 'default_model_not_set' }, { status: 400 })),
    );
    const user = userEvent.setup();
    const { client } = renderInField();

    await dragThinkingTo(user, FOLLOWING_BUILT_IN, 3);
    await waitForMutationsIdle(client);

    expect(await screen.findByText('default_model_not_set')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: FOLLOWING_BUILT_IN })).toBeInTheDocument();
  });

  it('keeps a cleared personal model cleared when a thinking change still in flight then fails', async () => {
    let modelId: DefaultModelResponse['modelId'] = 'openai/gpt-5';
    let releaseThinkingPut = () => {};
    const thinkingPutHeld = new Promise<void>(resolve => {
      releaseThinkingPut = resolve;
    });
    stubPersonalCatalog(models);
    server.use(
      http.get(DEFAULT_MODEL_URL, () => HttpResponse.json({ modelId, thinkingLevel: null })),
      http.put(THINKING_URL, async () => {
        await thinkingPutHeld;
        return HttpResponse.json({ error: 'default_model_not_set' }, { status: 400 });
      }),
      http.delete(DEFAULT_MODEL_URL, () => {
        modelId = null;
        return HttpResponse.json({ ok: true, modelId });
      }),
    );
    const user = userEvent.setup();
    const { client } = renderInField();
    const modelPicker = await screen.findByRole('combobox', { name: 'Personal default model' });

    await dragThinkingTo(user, FOLLOWING_BUILT_IN, 3);
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(modelPicker).toHaveValue(''));
    releaseThinkingPut();
    await waitForMutationsIdle(client);

    expect(await screen.findByText('default_model_not_set')).toBeInTheDocument();
    expect(modelPicker).toHaveValue('');
  });
});
