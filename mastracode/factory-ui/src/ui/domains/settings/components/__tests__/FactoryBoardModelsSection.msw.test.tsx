/**
 * Work and Review session models are optional overrides of the Factory
 * default. "Use Factory default" PATCHes null; picking a catalog model
 * PATCHes that id. The Factory default picker is unchanged.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import type { AvailableModelOption } from '../../../../../hooks/useAvailableModels';
import { FactoryBoardModelsSection } from '../FactoryBoardModelsSection';

const models: AvailableModelOption[] = [
  { id: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', modelName: 'claude-sonnet-4-5', hasApiKey: true },
  { id: 'openai/gpt-5', provider: 'openai', modelName: 'gpt-5', hasApiKey: true },
];

function renderSection() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/factories/fp-1/settings/models']}>
      <Routes>
        <Route path="/factories/:factoryId/settings/models" element={<FactoryBoardModelsSection models={models} />} />
      </Routes>
    </MemoryRouter>,
  );
}

function stubProject(saved: {
  defaultModelId: string | null;
  workModelId?: string | null;
  reviewModelId?: string | null;
}) {
  const patchedBodies: unknown[] = [];
  let project = {
    id: 'fp-1',
    name: 'Mastra',
    defaultModelId: saved.defaultModelId,
    workModelId: saved.workModelId ?? null,
    reviewModelId: saved.reviewModelId ?? null,
  };
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1`, () => HttpResponse.json({ project })),
    http.patch(`${TEST_BASE_URL}/web/factory/projects/fp-1`, async ({ request }) => {
      const body = (await request.json()) as Record<string, string | null>;
      patchedBodies.push(body);
      project = { ...project, ...body };
      return HttpResponse.json({ project });
    }),
  );
  return { patchedBodies };
}

describe('FactoryBoardModelsSection', () => {
  it('offers Use Factory default and saves a work-session override', async () => {
    const { patchedBodies } = stubProject({ defaultModelId: 'anthropic/claude-sonnet-4-5' });
    const user = userEvent.setup();
    renderSection();

    const work = await screen.findByRole('combobox', { name: 'Work sessions' });
    await waitFor(() => expect(work).toBeEnabled());
    await user.click(work);
    expect(await screen.findByRole('option', { name: /use factory default/i })).toBeInTheDocument();
    const option = await screen.findByRole('option', { name: /openai\/gpt-5/ });
    fireEvent.pointerDown(option, { pointerType: 'mouse' });
    fireEvent.click(option, { detail: 1 });

    await waitFor(() => expect(patchedBodies).toEqual([{ workModelId: 'openai/gpt-5' }]));
  });

  it('clears a review-session override back to the factory default', async () => {
    const { patchedBodies } = stubProject({
      defaultModelId: 'anthropic/claude-sonnet-4-5',
      reviewModelId: 'openai/gpt-5',
    });
    const user = userEvent.setup();
    renderSection();

    const review = await screen.findByRole('combobox', { name: 'Review sessions' });
    await waitFor(() => expect(review).toBeEnabled());
    await user.click(review);
    const option = await screen.findByRole('option', { name: /use factory default/i });
    fireEvent.pointerDown(option, { pointerType: 'mouse' });
    fireEvent.click(option, { detail: 1 });

    await waitFor(() => expect(patchedBodies).toEqual([{ reviewModelId: null }]));
  });
});
