import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../../../e2e/ui/render';
import type { FactoryModelScope } from '../../../../../workspaces/services/github';
import { pickModel } from '../../defaults/__tests__/default-model-test-utils';
import { ModelRoutingSection } from '../ModelRoutingSection';

const FACTORY_URL = `${TEST_BASE_URL}/web/factory/projects/fp-1`;

function stubFactory(modelScope: FactoryModelScope, patchStatus = 200) {
  const patchedBodies: unknown[] = [];
  let saved = modelScope;
  server.use(
    http.get(`${TEST_BASE_URL}/web/config/default-model`, () =>
      HttpResponse.json({ modelId: null, thinkingLevel: null }),
    ),
    http.get(FACTORY_URL, () => HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra', modelScope: saved } })),
    http.get(`${TEST_BASE_URL}/web/config/models`, () =>
      HttpResponse.json({
        models: [{ id: 'openai/gpt-5', provider: 'openai', modelName: 'gpt-5', hasApiKey: true }],
      }),
    ),
    http.patch<never, { modelScope?: FactoryModelScope }>(FACTORY_URL, async ({ request }) => {
      const body = await request.json();
      patchedBodies.push(body);
      if (patchStatus !== 200) return HttpResponse.json({ error: 'forbidden' }, { status: patchStatus });
      saved = body.modelScope ?? saved;
      return HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra', modelScope: saved } });
    }),
  );
  return patchedBodies;
}

const renderRoutingSection = (entry = '/factories/fp-1/settings/models') =>
  renderWithProviders(
    <MemoryRouter initialEntries={[entry]}>
      <ModelRoutingSection factoryId="fp-1" />
    </MemoryRouter>,
  );

const routing = (label: string) => screen.getByRole('radio', { name: label });
const region = (label: string) => screen.getByRole('region', { name: label });

describe('ModelRoutingSection', () => {
  it('routes chats to personal defaults and work-item runs to Factory defaults in a hybrid Factory', async () => {
    stubFactory('hybrid');
    renderRoutingSection();

    await waitFor(() => expect(routing('Hybrid')).toBeChecked());
    expect(within(region('Chats')).getByText('Uses Personal defaults')).toBeInTheDocument();
    expect(within(region('Work-item runs')).getByText('Uses Factory defaults')).toBeInTheDocument();
    expect(
      await within(region('Personal defaults')).findByRole('combobox', { name: 'Personal default model' }),
    ).toBeInTheDocument();
    expect(
      within(region('Factory defaults')).getByRole('combobox', { name: 'Factory default model' }),
    ).toBeInTheDocument();
  });

  it('saves a new routing and collapses the defaults it leaves unused', async () => {
    const patchedBodies = stubFactory('user');
    const user = userEvent.setup();
    const { client } = renderRoutingSection();

    await waitFor(() => expect(routing('Personal')).toBeChecked());
    expect(
      within(region('Factory defaults')).getByText('Used only when someone has no personal default'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Factory default model' })).not.toBeInTheDocument();

    await user.click(routing('Factory'));
    await waitForMutationsIdle(client);

    expect(patchedBodies).toEqual([{ modelScope: 'factory' }]);
    expect(routing('Factory')).toBeChecked();
    expect(within(region('Chats')).getByText('Uses Factory defaults')).toBeInTheDocument();
    expect(within(region('Personal defaults')).getByText('Not used in this scope')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Personal default model' })).not.toBeInTheDocument();
    expect(within(region('Factory defaults')).getByRole('button', { name: 'Add provider' })).toBeInTheDocument();
    expect(within(region('Factory defaults')).queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument();
  });

  it('lets an admin change the Factory default from the unused Factory card in Personal routing', async () => {
    const patchedBodies = stubFactory('user');
    const user = userEvent.setup();
    const { client } = renderRoutingSection();

    await waitFor(() => expect(routing('Personal')).toBeChecked());
    await user.click(within(region('Factory defaults')).getByRole('button', { name: 'Settings' }));
    await pickModel(user, 'Factory default model', 'openai/gpt-5');
    await waitForMutationsIdle(client);

    expect(patchedBodies).toEqual([{ defaultModelId: 'openai/gpt-5' }]);
  });

  it('opens the unused Factory card when a link targets it', async () => {
    stubFactory('user');
    renderRoutingSection('/factories/fp-1/settings/models#factory-defaults');

    expect(
      await within(await screen.findByRole('region', { name: 'Factory defaults' })).findByRole('combobox', {
        name: 'Factory default model',
      }),
    ).toBeInTheDocument();
  });

  it('keeps the saved routing when a change is rejected', async () => {
    stubFactory('hybrid', 403);
    const user = userEvent.setup();
    const { client } = renderRoutingSection();

    await waitFor(() => expect(routing('Hybrid')).toBeChecked());
    await user.click(routing('Factory'));
    await waitForMutationsIdle(client);

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to update Factory model scope (403)');
    expect(routing('Hybrid')).toBeChecked();
  });

  it('offers no routing to pick when the Factory cannot be loaded', async () => {
    server.use(http.get(FACTORY_URL, () => HttpResponse.json({ error: 'unavailable' }, { status: 503 })));
    renderRoutingSection();

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load Factory (503)');
    expect(screen.queryByRole('radiogroup', { name: 'Model routing' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Personal defaults' })).not.toBeInTheDocument();
  });
});
