import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../e2e/ui/msw-server';
import { serveProject, storedBoard } from './fixtures/canvas';
import { FACTORY_ID, PROJECT_URL, renderAt } from './fixtures/factory-app';
import { storedWorkBoard } from './fixtures/work-board';

describe('Creating a board', () => {
  it('creates a board from the starter phases under a key derived from its name, then opens its settings', async () => {
    const { created } = serveProject();
    const user = userEvent.setup();
    const { router } = renderAt(`/factories/${FACTORY_ID}/new-board`);

    const form = within(await screen.findByRole('form', { name: 'New board' }));
    expect(form.getByRole('button', { name: 'Create board' })).toBeDisabled();
    await user.type(form.getByLabelText('Board name'), 'Bug Triage');
    expect(form.getByLabelText('Board key')).toHaveValue('bug-triage');
    // Cards only reach a new board through its rules, checked in the project's intake order.
    expect(form.getByRole('link', { name: 'intake order' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/work/intake#intake-order`,
    );
    await user.click(form.getByRole('button', { name: 'Create board' }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/boards/bug-triage/config`),
    );
    expect(created).toHaveBeenCalledWith({
      key: 'bug-triage',
      name: 'Bug Triage',
      description: null,
      phases: [
        { key: 'backlog', name: 'Backlog', kind: 'resting', nextPhases: ['doing'] },
        { key: 'doing', name: 'Doing', kind: 'working', runner: { context: 'work' }, nextPhases: ['done'] },
        { key: 'done', name: 'Done', kind: 'terminal', nextPhases: [] },
      ],
    });
    expect(await screen.findByRole('textbox', { name: 'Board name' })).toHaveValue('Bug Triage');
    // The canvas lays out the starter phases once the new board is in the catalog.
    const phases = within(await screen.findByRole('list', { name: 'Phases' }));
    expect(await phases.findByRole('link', { name: 'Doing' })).toBeInTheDocument();
  });

  it('keeps the key as typed once it was typed by hand, and refuses keys the server would refuse', async () => {
    serveProject();
    const user = userEvent.setup();
    renderAt(`/factories/${FACTORY_ID}/new-board`);

    const form = within(await screen.findByRole('form', { name: 'New board' }));
    const key = form.getByLabelText('Board key');
    const create = form.getByRole('button', { name: 'Create board' });
    await user.type(form.getByLabelText('Board name'), 'Bugs');

    await user.clear(key);
    await user.type(key, 'bug triage');
    expect(form.getByText(/Use letters, digits, hyphens and underscores/)).toBeInTheDocument();
    expect(create).toBeDisabled();

    await user.clear(key);
    expect(form.getByText('Enter a key.')).toBeInTheDocument();

    await user.type(key, 'work');
    expect(form.getByText('This key is already in use.')).toBeInTheDocument();
    expect(create).toBeDisabled();

    await user.clear(key);
    await user.type(key, 'bugs-board');
    await user.type(form.getByLabelText('Board name'), ' and more');
    expect(key).toHaveValue('bugs-board');
    expect(create).toBeEnabled();
  });

  it.each([
    ['code_board', 'release', 'Board "release" is defined in code; it cannot be created here.'],
    ['board_exists', 'bugs', 'Board "bugs" already exists in this project.'],
  ])('shows a %s refusal on the key and keeps the form', async (error, typed, message) => {
    serveProject();
    server.use(http.post(`${PROJECT_URL}/boards`, () => HttpResponse.json({ error, message }, { status: 409 })));
    const user = userEvent.setup();
    const { router } = renderAt(`/factories/${FACTORY_ID}/new-board`);

    const form = within(await screen.findByRole('form', { name: 'New board' }));
    await user.type(form.getByLabelText('Board name'), typed);
    await user.click(form.getByRole('button', { name: 'Create board' }));

    expect(await form.findByText(message)).toBeInTheDocument();
    expect(form.getByLabelText('Board name')).toHaveValue(typed);
    expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/new-board`);
  });

  it('shows a refusal that is not about the key above the form', async () => {
    serveProject();
    server.use(
      http.post(`${PROJECT_URL}/boards`, () =>
        HttpResponse.json(
          { error: 'unknown_skill', message: 'Phase "doing" runs skill "missing", which is not installed.' },
          { status: 422 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderAt(`/factories/${FACTORY_ID}/new-board`);

    const form = within(await screen.findByRole('form', { name: 'New board' }));
    await user.type(form.getByLabelText('Board name'), 'Bugs');
    await user.click(form.getByRole('button', { name: 'Create board' }));

    const alert = await form.findByRole('alert');
    expect(alert).toHaveTextContent('The board was not created');
    expect(alert).toHaveTextContent('which is not installed');
    expect(form.queryByText('This key is already in use.')).not.toBeInTheDocument();
  });

  it("copies an existing board's phases and description", async () => {
    const bugs = storedBoard('bugs', 'Bugs', { description: 'Reported bugs' });
    const { created } = serveProject({ stored: [bugs] });
    const user = userEvent.setup();
    renderAt(`/factories/${FACTORY_ID}/new-board`);

    const form = within(await screen.findByRole('form', { name: 'New board' }));
    await user.type(form.getByLabelText('Board name'), 'Incidents');
    await user.click(form.getByRole('combobox', { name: 'Start from' }));
    await user.click(await screen.findByRole('option', { name: 'Copy of Bugs' }));
    await waitFor(() => expect(form.getByRole('combobox', { name: 'Start from' })).toHaveTextContent('Bugs'));
    await user.click(form.getByRole('button', { name: 'Create board' }));

    await waitFor(() => expect(created).toHaveBeenCalled());
    expect(created).toHaveBeenCalledWith({
      key: 'incidents',
      name: 'Incidents',
      description: 'Reported bugs',
      phases: bugs.board.phases,
    });
  });

  it('goes back to what it started from when a copy cannot be read', async () => {
    serveProject({ stored: [storedBoard('bugs', 'Bugs')] });
    server.use(
      http.get(`${PROJECT_URL}/boards/bugs`, () =>
        HttpResponse.json({ error: 'internal', message: 'Storage is down.' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderAt(`/factories/${FACTORY_ID}/new-board`);

    const form = within(await screen.findByRole('form', { name: 'New board' }));
    await user.click(form.getByRole('combobox', { name: 'Start from' }));
    await user.click(await screen.findByRole('option', { name: 'Copy of Bugs' }));

    expect(await form.findByRole('alert')).toHaveTextContent('The board was not copied');
    expect(form.getByRole('combobox', { name: 'Start from' })).toHaveTextContent('Backlog, Doing, Done');
  });

  it('copies the Work board exactly', async () => {
    const { created } = serveProject();
    const user = userEvent.setup();
    renderAt(`/factories/${FACTORY_ID}/new-board`);

    const form = within(await screen.findByRole('form', { name: 'New board' }));
    await user.type(form.getByLabelText('Board name'), 'Work two');
    await user.click(form.getByRole('combobox', { name: 'Start from' }));
    await user.click(await screen.findByRole('option', { name: 'Copy of Work' }));
    await waitFor(() => expect(form.getByRole('combobox', { name: 'Start from' })).toHaveTextContent('Work'));
    await user.click(form.getByRole('button', { name: 'Create board' }));

    await waitFor(() => expect(created).toHaveBeenCalled());
    expect(created.mock.calls[0]?.[0]).toMatchObject({ key: 'work-two', phases: storedWorkBoard().board.phases });
  });

  it('tells a member that only admins create boards', async () => {
    serveProject({ canEdit: false });
    renderAt(`/factories/${FACTORY_ID}/new-board`);

    expect(await screen.findByText('Only organization admins can create boards.')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'New board' })).not.toBeInTheDocument();
  });
});
