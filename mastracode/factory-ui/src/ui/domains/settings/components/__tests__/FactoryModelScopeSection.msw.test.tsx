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

function stubProject(modelScope: 'factory' | 'user' | 'hybrid', patchStatus = 200) {
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
        (body.modelScope !== 'factory' && body.modelScope !== 'user' && body.modelScope !== 'hybrid')
      ) {
        return HttpResponse.json({ error: 'invalid_project' }, { status: 400 });
      }

      saved = body.modelScope;
      return HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra', modelScope: saved } });
    }),
  );

  return patchedBodies;
}

async function chooseScope(user: ReturnType<typeof userEvent.setup>, label = 'Factory model and credentials') {
  const combobox = screen.getByRole('combobox', { name: 'Model scope' });
  await waitFor(() => expect(combobox).toBeEnabled());
  await user.click(combobox);
  const option = await screen.findByRole('option', { name: label });
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
    expect(
      screen.getByText(
        "Hybrid: sessions use their owner's credentials and default model, while work items use organization credentials and the Factory default. Factory and User apply one of those to both. Changing the scope never replaces a model a thread already selected.",
      ),
    ).toBeInTheDocument();
  });

  it('saves the selected model scope and updates the displayed value', async () => {
    const patchedBodies = stubProject('user');
    const user = userEvent.setup();
    const { client } = renderSection();

    const combobox = await chooseScope(user);
    await waitForMutationsIdle(client);

    expect(patchedBodies).toEqual([{ modelScope: 'factory' }]);
    expect(combobox).toHaveTextContent('Factory model and credentials');
  });

  it('renders a hybrid Factory with the hybrid label', async () => {
    stubProject('hybrid');

    renderSection();

    const combobox = screen.getByRole('combobox', { name: 'Model scope' });
    await waitFor(() => expect(combobox).toHaveTextContent('Personal for sessions, Factory for work items'));
  });

  it('offers the hybrid scope and saves it', async () => {
    const patchedBodies = stubProject('factory');
    const user = userEvent.setup();
    const { client } = renderSection();

    const combobox = await chooseScope(user, 'Personal for sessions, Factory for work items');
    await waitForMutationsIdle(client);

    expect(patchedBodies).toEqual([{ modelScope: 'hybrid' }]);
    expect(combobox).toHaveTextContent('Personal for sessions, Factory for work items');
  });

  it('shows an inline error when saving fails', async () => {
    stubProject('user', 400);
    const user = userEvent.setup();
    const { client } = renderSection();

    await chooseScope(user);
    await waitForMutationsIdle(client);

    expect(screen.getByText('Failed to update Factory model scope (400)')).toBeInTheDocument();
  });
});
