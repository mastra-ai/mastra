import type { ModelPack } from '@mastra/factory/model-packs';
import type { PersonalModelDefaultsResponse } from '@mastra/factory/routes/config';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../e2e/ui/render';
import { createAppRoutes } from '../../router';
import { DRAFT_SESSION_ID, FACTORY_ID, stubDraftRoute } from './fixtures/draftRoute';

if (typeof globalThis.Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const everyday: ModelPack = {
  id: 'everyday',
  name: 'Everyday',
  models: [{ modelId: 'openai/gpt-4o-mini', thinkingLevel: 'medium' }],
};
const deep: ModelPack = {
  id: 'deep',
  name: 'Deep',
  models: [
    { modelId: 'openai/gpt-5.4-mini', thinkingLevel: 'high' },
    { modelId: 'openai/gpt-4o-mini', thinkingLevel: 'low' },
  ],
};
const personalDefaults: PersonalModelDefaultsResponse = {
  modelId: 'openai/gpt-4o-mini',
  thinkingLevel: 'medium',
  modelPacks: [everyday, deep],
  defaultModelPackId: 'everyday',
};

function stubPackRoute() {
  const route = stubDraftRoute({ defaultModelId: 'openai/gpt-4o-mini' });
  server.use(http.get(`${TEST_BASE_URL}/web/config/default-model`, () => HttpResponse.json(personalDefaults)));
  return route;
}

async function openDraft() {
  const user = userEvent.setup();
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [`/factories/${FACTORY_ID}/user/new/${DRAFT_SESSION_ID}`],
  });
  const { client } = renderWithProviders(<RouterProvider router={router} />);
  const message = await screen.findByRole('textbox', { name: 'Message' });
  await waitFor(() => expect(message).toBeEnabled());
  const modelPicker = await screen.findByLabelText('Session model');
  await waitFor(() => expect(modelPicker).toBeEnabled());
  return { user, client, message, modelPicker };
}

describe('a model pack picked in a user session draft', () => {
  it('shows the default pack as active before anything is picked', async () => {
    stubPackRoute();
    const { user, modelPicker } = await openDraft();

    expect(within(modelPicker).getByText('Everyday')).toBeInTheDocument();
    await user.click(modelPicker);
    const packs = await screen.findByRole('region', { name: 'Packs' });
    expect(within(packs).getByRole('button', { name: 'Everyday' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(packs).getByRole('button', { name: 'Deep' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('starts the new session on the picked pack before the first prompt is sent', async () => {
    const route = stubPackRoute();
    const { user, client, message, modelPicker } = await openDraft();

    await user.click(modelPicker);
    const packs = await screen.findByRole('region', { name: 'Packs' });
    await user.click(within(packs).getByRole('button', { name: 'Deep' }));
    await waitFor(() => expect(within(modelPicker).getByText('Deep')).toBeInTheDocument());
    await user.keyboard('{Escape}');
    await user.type(message, 'dig into the flaky test');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(route.posted).toEqual(['dig into the flaky test']));
    expect(route.bindingsBeforePrompt).toEqual(['pack:deep']);

    route.finishWorkspace();
    await waitForMutationsIdle(client);
  });

  it('leaves the server default in place when nothing is picked', async () => {
    const route = stubPackRoute();
    const { user, client, message } = await openDraft();

    await user.type(message, 'keep it simple');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(route.posted).toEqual(['keep it simple']));
    expect(route.modelSwitchRequests).toBe(0);

    route.finishWorkspace();
    await waitForMutationsIdle(client);
  });
});
