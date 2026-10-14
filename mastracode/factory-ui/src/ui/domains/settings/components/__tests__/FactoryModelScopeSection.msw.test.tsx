import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { FactoryModelScopeSection } from '../FactoryModelScopeSection';

function renderSection() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/factories/fp-1/settings/models']}>
      <Routes>
        <Route path="/factories/:factoryId/settings/models" element={<FactoryModelScopeSection />} />
      </Routes>
    </MemoryRouter>,
  );
}

function stubProject(modelScope: 'factory' | 'user', patchStatus = 200) {
  const patchedBodies: unknown[] = [];
  let saved = modelScope;

  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1`, () =>
      HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra', modelScope: saved } }),
    ),
    http.patch(`${TEST_BASE_URL}/web/factory/projects/fp-1`, async ({ request }) => {
      const body: unknown = await request.json();
      patchedBodies.push(body);

      if (patchStatus !== 200) {
        return HttpResponse.json({ error: 'invalid_project' }, { status: patchStatus });
      }
      if (
        typeof body !== 'object' ||
        body === null ||
        !('modelScope' in body) ||
        (body.modelScope !== 'factory' && body.modelScope !== 'user')
      ) {
        return HttpResponse.json({ error: 'invalid_project' }, { status: 400 });
      }

      saved = body.modelScope;
      return HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra', modelScope: saved } });
    }),
  );

  return patchedBodies;
}

async function chooseFactoryScope(user: ReturnType<typeof userEvent.setup>) {
  const combobox = screen.getByRole('combobox', { name: 'Model scope' });
  await waitFor(() => expect(combobox).toBeEnabled());
  await user.click(combobox);
  const option = await screen.findByRole('option', { name: 'Factory model and credentials' });
  fireEvent.pointerDown(option, { pointerType: 'mouse' });
  fireEvent.click(option, { detail: 1 });
  return combobox;
}

describe('FactoryModelScopeSection', () => {
  it('renders the saved model scope', async () => {
    stubProject('user');

    renderSection();

    const combobox = screen.getByRole('combobox', { name: 'Model scope' });
    await waitFor(() => expect(combobox).toBeEnabled());
    expect(combobox).toHaveTextContent("Each user's model and credentials");
  });

  it('saves the selected model scope and updates the displayed value', async () => {
    const patchedBodies = stubProject('user');
    const user = userEvent.setup();
    const { client } = renderSection();

    const combobox = await chooseFactoryScope(user);
    await waitForMutationsIdle(client);

    expect(patchedBodies).toEqual([{ modelScope: 'factory' }]);
    expect(combobox).toHaveTextContent('Factory model and credentials');
  });

  it('shows an inline error when saving fails', async () => {
    stubProject('user', 400);
    const user = userEvent.setup();
    const { client } = renderSection();

    await chooseFactoryScope(user);
    await waitForMutationsIdle(client);

    expect(screen.getByText('Failed to update Factory model scope (400)')).toBeInTheDocument();
  });
});
