import { Field } from '@mastra/playground-ui/components/Field';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../../../e2e/ui/render';
import type { DefaultModelResponse } from '../../../../../../../api/types';
import type { AvailableModelOption } from '../../../../../../../hooks/useAvailableModels';
import { PersonalDefaultModel } from '../PersonalDefaultModel';
import { pickModel } from './default-model-test-utils';

const renderInField = () =>
  renderWithProviders(
    <Field>
      <PersonalDefaultModel />
    </Field>,
  );

const DEFAULT_MODEL_URL = `${TEST_BASE_URL}/web/config/default-model`;
const MODELS_URL = `${TEST_BASE_URL}/web/config/models`;
const UNAVAILABLE_WARNING = /None of your connected accounts can run/;

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

describe('PersonalDefaultModel', () => {
  it('saves a picked model as the personal default', async () => {
    let modelId: DefaultModelResponse['modelId'] = null;
    let putBody: unknown;
    stubPersonalCatalog(models);
    server.use(
      http.get(DEFAULT_MODEL_URL, () => HttpResponse.json({ modelId })),
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
      http.get(DEFAULT_MODEL_URL, () => HttpResponse.json({ modelId: 'openai/gpt-5' })),
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
      http.get(DEFAULT_MODEL_URL, () => HttpResponse.json({ modelId })),
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
    server.use(http.get(DEFAULT_MODEL_URL, () => HttpResponse.json({ modelId: 'deepseek/deepseek-flash' })));

    renderInField();

    expect(await screen.findByText(UNAVAILABLE_WARNING)).toBeInTheDocument();
  });

  it('does not flag the default while the personal catalog is unknown', async () => {
    server.use(
      http.get(MODELS_URL, () => HttpResponse.json({ error: 'unavailable' }, { status: 503 })),
      http.get(DEFAULT_MODEL_URL, () => HttpResponse.json({ modelId: 'deepseek/deepseek-flash' })),
    );
    const { client } = renderInField();

    await screen.findByRole('combobox', { name: 'Personal default model' });
    await waitForMutationsIdle(client);

    expect(screen.queryByText(UNAVAILABLE_WARNING)).not.toBeInTheDocument();
  });

  it('does not flag a default the personal catalog offers', async () => {
    stubPersonalCatalog(models);
    server.use(http.get(DEFAULT_MODEL_URL, () => HttpResponse.json({ modelId: 'openai/gpt-5' })));
    const user = userEvent.setup();
    renderInField();

    await user.click(await screen.findByRole('combobox', { name: 'Personal default model' }));
    expect(await screen.findByRole('option', { name: /openai\/gpt-5/ })).toBeInTheDocument();
    expect(screen.queryByText(UNAVAILABLE_WARNING)).not.toBeInTheDocument();
  });
});
