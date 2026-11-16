import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../e2e/ui/msw-server';
import { renderWithProviders, waitForMutationsIdle } from '../../../../../e2e/ui/render';
import { BoardRules } from '../components/BoardRules';
import { FACTORY_ID, PROJECT_URL, rule, ruleId, serveRules } from './fixtures/rulesServer';

const OPENED = 'Issue opened';

function renderRules(boardId = 'work') {
  return renderWithProviders(
    <MemoryRouter>
      <BoardRules factoryId={FACTORY_ID} boardId={boardId} />
    </MemoryRouter>,
  );
}

function lane(label: string) {
  return within(screen.getByRole('region', { name: label }));
}

/** The rule names a lane checks, top to bottom. */
function ruleNames(label: string) {
  return lane(label)
    .getAllByRole('listitem')
    .map(item => item.getAttribute('aria-label'))
    .filter(Boolean);
}

const bugs = () =>
  rule({
    id: ruleId('bugs'),
    name: 'Bugs go to Triage',
    when: { operator: 'AND', conditions: [{ field: 'item.labels', operator: 'contains', value: 'bug' }] },
    target: { boardKey: 'work', phaseKey: 'triage', joinClosedIssue: false, moveToBoardKey: null },
  });
const everythingElse = () => rule({ id: ruleId('everything'), name: 'Everything else goes to Intake' });
const closed = () =>
  rule({
    id: ruleId('closed'),
    name: 'Closed issues go to Done',
    on: ['work_item.closed'],
    target: { boardKey: 'work', phaseKey: 'done', joinClosedIssue: false, moveToBoardKey: null },
  });

describe('Board rules', () => {
  it('shows each trigger as a lane, the opened lane first with where the board sits in intake order', async () => {
    serveRules({
      rules: [bugs(), everythingElse(), rule({ id: ruleId('late'), name: 'Never checked' }), closed()],
      order: ['release', 'work'],
    });
    renderRules();

    const regions = await screen.findAllByRole('region');
    expect(regions[0]).toHaveAccessibleName('Issues');
    expect(regions[1]).toHaveAccessibleName(OPENED);
    expect(ruleNames(OPENED)).toEqual(['Bugs go to Triage', 'Everything else goes to Intake', 'Never checked']);
    expect(ruleNames('Issue closed')).toEqual(['Closed issues go to Done']);
    expect(await lane(OPENED).findByRole('link', { name: 'checked last, after Release Preview' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/settings/intake#intake-order`,
    );
    // A rule under one that takes every item is never reached.
    expect(
      within(lane(OPENED).getByRole('listitem', { name: 'Never checked' })).getByText(
        'Never reached: rule 2 above matches every item.',
      ),
    ).toBeVisible();
    expect(lane('Issue reopened').getByText('No rules: the card stays where it is')).toBeVisible();
  });

  it('groups lanes into issues and pull requests, with the intake note on every lane that can file an item with no card', async () => {
    serveRules({ rules: [bugs(), closed()], order: ['release', 'work'] });
    renderRules();

    const lanesIn = (name: string) =>
      within(screen.getByRole('region', { name }))
        .getAllByRole('region')
        .map(region => region.getAttribute('aria-label'));
    await screen.findByRole('region', { name: 'Issues' });
    expect(lanesIn('Issues')).toEqual([
      'Issue opened',
      'Issue reopened',
      'Issue labels or assignees change',
      'Issue closed',
    ]);
    expect(lanesIn('Pull requests')).toEqual([
      'Pull request opened',
      'Pull request reopened',
      'Pull request labels or assignees change',
      'Pull request gets new commits',
      'Review requested',
      'Pull request merged',
      'Pull request closed unmerged',
    ]);
    expect(
      lane('Pull request opened').getByText('Links to its issue’s card if one exists; otherwise filed as a new card.'),
    ).toBeVisible();

    const note = 'No card yet: checked last, after Release Preview; first matching rule files it on this board.';
    const filing = [
      'Issue opened',
      'Issue reopened',
      'Issue labels or assignees change',
      'Pull request opened',
      'Pull request reopened',
      'Pull request labels or assignees change',
    ];
    for (const label of filing) {
      expect(
        await lane(label).findByText((_, element) => element?.tagName === 'P' && element.textContent === note),
      ).toBeVisible();
    }
    for (const label of ['Issue closed', 'Pull request merged', 'Review requested']) {
      expect(lane(label).queryByText(/No card yet/)).not.toBeInTheDocument();
    }
  });

  it('shows a rule on the old opened event in both arrival lanes, marked legacy, and keeps its event on edit', async () => {
    const { sent } = serveRules({
      rules: [{ ...rule({ id: ruleId('legacy'), name: 'Old intake rule' }), on: ['work_item.created' as never] }],
    });
    const user = userEvent.setup();
    const { client } = renderRules();

    await screen.findByRole('region', { name: OPENED });
    for (const label of [OPENED, 'Pull request opened']) {
      const row = within(await lane(label).findByRole('listitem', { name: 'Old intake rule' }));
      expect(row.getByText('Issue or pull request opened (legacy)')).toBeVisible();
    }

    await user.click(lane(OPENED).getByRole('button', { name: 'Edit conditions of Old intake rule' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Edit rule' }));
    await user.click(dialog.getByRole('button', { name: /Trigger/ }));
    expect(dialog.getByText(/Also listens on “Issue or pull request opened \(legacy\)”/)).toBeVisible();
    await user.click(dialog.getByRole('button', { name: /Review/ }));
    const name = dialog.getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Old intake rule, renamed');
    await user.click(dialog.getByRole('button', { name: 'Save rule' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitForMutationsIdle(client);
    expect(sent.find(request => request.method === 'PATCH')?.body).toMatchObject({
      name: 'Old intake rule, renamed',
      on: ['work_item.created'],
    });
  });

  it('reads a rule on a label change in words', async () => {
    serveRules({
      rules: [
        rule({
          name: 'Hotfixes jump the queue',
          on: ['work_item.updated'],
          when: { operator: 'AND', conditions: [{ field: 'event.labels.added', operator: 'equals', value: 'hotfix' }] },
        }),
      ],
    });
    renderRules();

    const name = 'Issue labels or assignees change';
    await screen.findByRole('region', { name });
    expect(lane(name).getByText('Label added has hotfix')).toBeVisible();
    expect(screen.queryByText(/event\.labels/i)).not.toBeInTheDocument();
  });

  it('groups the rule builder triggers the same way, under the same names', async () => {
    serveRules({ rules: [closed()] });
    const user = userEvent.setup();
    renderRules();

    await user.click(
      within(await screen.findByRole('region', { name: 'Issue closed' })).getByRole('button', { name: 'Add rule' }),
    );
    const dialog = within(await screen.findByRole('dialog', { name: 'Add rule' }));
    await user.click(dialog.getByRole('button', { name: /Trigger/ }));
    const checkboxes = (group: string) =>
      within(dialog.getByRole('group', { name: group }))
        .getAllByRole('checkbox')
        .map(box => box.textContent);
    expect(checkboxes('Issues')).toHaveLength(4);
    expect(checkboxes('Issues')[0]).toContain('Issue opened');
    expect(checkboxes('Pull requests')).toHaveLength(7);
    expect(checkboxes('Pull requests')[0]).toContain(
      'Pull request openedLinks to its issue’s card if one exists; otherwise filed as a new card.',
    );
  });

  it('says an item no rule here takes goes on to the next board, then Not routed', async () => {
    serveRules({ rules: [bugs()] });
    renderRules();

    const footer = 'Otherwise: checked by the next board, then Not routed';
    await screen.findByRole('region', { name: OPENED });
    expect(lane(OPENED).getByText(footer)).toBeVisible();
    expect(lane('Pull request opened').getByText(footer)).toBeVisible();
    expect(lane('Issue reopened').queryByText(footer)).not.toBeInTheDocument();
  });

  it('adds a rule for new items on this board, above the rule taking everything else', async () => {
    const { sent } = serveRules({ rules: [everythingElse(), closed()] });
    const user = userEvent.setup();
    const { client } = renderRules();

    await screen.findByRole('region', { name: OPENED });
    await user.click(lane(OPENED).getByRole('button', { name: 'Add rule' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Add rule' }));
    await user.click(dialog.getByRole('radio', { name: /Every item/ }));
    await user.click(dialog.getByRole('button', { name: 'Continue' }));
    // An item with no card yet can only land on this board, so there is no board to pick.
    expect(dialog.getByText('An item with no card yet can only be filed on this board.')).toBeVisible();
    expect(dialog.queryByRole('radiogroup', { name: 'Board' })).not.toBeInTheDocument();
    await user.click(dialog.getByRole('radio', { name: 'Planning' }));
    const name = dialog.getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'New items go to Planning');
    await user.click(dialog.getByRole('button', { name: 'Create rule' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitForMutationsIdle(client);
    expect(sent.find(request => request.method === 'POST' && request.path === '')?.body).toMatchObject({
      name: 'New items go to Planning',
      on: ['work_item.opened'],
      when: null,
      target: { boardKey: 'work', phaseKey: 'planning' },
    });
    await waitFor(() =>
      expect(ruleNames(OPENED)).toEqual(['New items go to Planning', 'Everything else goes to Intake']),
    );
  });

  it('keeps a new rule it created once, even when moving it above the lane’s catch-all fails', async () => {
    const closedAll = rule({
      id: ruleId('closed-all'),
      name: 'Every closed card goes to Done',
      on: ['work_item.closed'],
      target: { boardKey: 'work', phaseKey: 'done', joinClosedIssue: false, moveToBoardKey: null },
    });
    const { sent } = serveRules({ rules: [everythingElse(), closedAll] });
    server.use(
      http.post(`${PROJECT_URL}/intake-routes/reorder`, () =>
        HttpResponse.json({ error: 'internal', message: 'The database is busy.' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    const { client } = renderRules();

    const closedLane = within(await screen.findByRole('region', { name: 'Issue closed' }));
    await user.click(closedLane.getByRole('button', { name: 'Add rule' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Add rule' }));
    await user.click(dialog.getByRole('radio', { name: /Every card/ }));
    await user.click(dialog.getByRole('button', { name: 'Continue' }));
    await user.click(dialog.getByRole('radio', { name: 'Planning' }));
    await user.click(dialog.getByRole('button', { name: 'Create rule' }));

    // The rule exists now, so the dialog closes rather than inviting a second Create.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitForMutationsIdle(client);
    expect(sent.filter(request => request.method === 'POST' && request.path === '')).toHaveLength(1);
    await waitFor(() => expect(ruleNames('Issue closed')).toHaveLength(2));
  });

  it('moves a card-move rule earlier among this board’s rules only', async () => {
    const pushes = rule({
      id: ruleId('pushes'),
      name: 'Pushes re-review',
      on: ['pull_request.synchronized'],
      target: { boardKey: 'work', phaseKey: 'review', joinClosedIssue: false, moveToBoardKey: null },
    });
    const merged = rule({
      id: ruleId('merged'),
      name: 'Merged go to Done',
      on: ['pull_request.synchronized'],
      target: { boardKey: 'work', phaseKey: 'done', joinClosedIssue: false, moveToBoardKey: null },
    });
    // The opened lane's rule sits between them and must keep its slot.
    const { sent } = serveRules({ rules: [pushes, everythingElse(), merged] });
    const user = userEvent.setup();
    const { client } = renderRules();

    const laneName = 'Pull request gets new commits';
    await screen.findByRole('region', { name: laneName });
    const row = within(lane(laneName).getByRole('listitem', { name: 'Merged go to Done' }));
    await user.click(row.getByRole('button', { name: 'Check earlier' }));

    await waitForMutationsIdle(client);
    expect(sent.find(request => request.path === '/reorder')?.body).toEqual({
      boardKey: 'work',
      ids: [ruleId('merged'), ruleId('everything'), ruleId('pushes')],
    });
    await waitFor(() => expect(ruleNames(laneName)).toEqual(['Merged go to Done', 'Pushes re-review']));
  });

  it('sends a card-move rule’s cards to another board, keeping the rule on this one', async () => {
    const { sent } = serveRules({ rules: [closed()] });
    const user = userEvent.setup();
    const { client } = renderRules();

    await screen.findByRole('region', { name: 'Issue closed' });
    await user.click(screen.getByRole('button', { name: 'Edit where Closed issues go to Done moves the card' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Edit rule' }));
    await user.click(dialog.getByRole('radio', { name: 'Release Preview' }));
    await user.click(dialog.getByRole('radio', { name: 'Queued' }));
    await user.click(dialog.getByRole('button', { name: 'Save rule' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitForMutationsIdle(client);
    expect(sent.find(request => request.method === 'PATCH')?.body).toMatchObject({
      target: { boardKey: 'work', phaseKey: 'queued', moveToBoardKey: 'release' },
    });
    const row = within(lane('Issue closed').getByRole('listitem', { name: 'Closed issues go to Done' }));
    expect(
      await row.findByRole('button', { name: 'Edit where Closed issues go to Done moves the card' }),
    ).toHaveTextContent('Release Preview›Queued');
  });

  it('keeps the dialog open with the server’s reason when a rule doesn’t save', async () => {
    serveRules({ rules: [closed()] });
    server.use(
      http.patch(`${PROJECT_URL}/intake-routes/:routeId`, () =>
        HttpResponse.json(
          { error: 'unknown_board', message: 'Board "release" is not installed in this project.' },
          { status: 422 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderRules();

    await screen.findByRole('region', { name: 'Issue closed' });
    await user.click(screen.getByRole('button', { name: 'Edit where Closed issues go to Done moves the card' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Edit rule' }));
    await user.click(dialog.getByRole('radio', { name: 'Release Preview' }));
    await user.click(dialog.getByRole('radio', { name: 'Queued' }));
    await user.click(dialog.getByRole('button', { name: 'Save rule' }));

    expect(await dialog.findByRole('alert')).toHaveTextContent('Board "release" is not installed in this project.');
    expect(screen.getByRole('dialog', { name: 'Edit rule' })).toBeVisible();
  });

  it('says how often a card-move rule was skipped lately, and links the latest item', async () => {
    serveRules({
      rules: [closed()],
      skipped: [
        {
          routeId: ruleId('closed'),
          count: 3,
          latest: {
            id: '00000000-0000-4000-8000-0000000000aa',
            outcome: 'rule_skipped',
            evaluator: 'intake-order',
            boardKey: 'work',
            routeId: ruleId('closed'),
            reason:
              'The card-move rule matched work_item.closed but was skipped: phase "done" doesn\'t take cards from "triage".',
            sourceKey: 'mastra-ai/mastra#12',
            title: 'Fix the flaky test',
            url: 'https://github.com/mastra-ai/mastra/issues/12',
            decidedAt: '2026-11-15T10:00:00.000Z',
          },
        },
      ],
    });
    renderRules();

    await screen.findByRole('region', { name: 'Issue closed' });
    const row = within(lane('Issue closed').getByRole('listitem', { name: 'Closed issues go to Done' }));
    expect(
      await row.findByText('Skipped 3 times in the last 30 days: phase "done" doesn\'t take cards from "triage".'),
    ).toBeVisible();
    expect(row.getByRole('link', { name: 'Latest: Fix the flaky test' })).toHaveAttribute(
      'href',
      'https://github.com/mastra-ai/mastra/issues/12',
    );
  });

  it('reloads the rules and says so when someone else changed one first', async () => {
    const { state } = serveRules({ rules: [closed()] });
    const user = userEvent.setup();
    renderRules();

    await screen.findByRole('region', { name: 'Issue closed' });
    const current = state.rules[0];
    if (current) state.rules[0] = { ...current, name: 'Renamed by a teammate', revision: current.revision + 1 };
    await user.click(screen.getByRole('button', { name: 'Edit conditions of Closed issues go to Done' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Edit rule' }));
    await user.click(dialog.getByRole('button', { name: 'Save rule' }));

    expect(await dialog.findByRole('alert')).toHaveTextContent(
      'Someone else changed these rules first. They have been reloaded; try again.',
    );
    await user.click(dialog.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(ruleNames('Issue closed')).toEqual(['Renamed by a teammate']));
  });

  it('turns a rule off, which marks it skipped', async () => {
    const { sent } = serveRules({ rules: [closed()] });
    const user = userEvent.setup();
    const { client } = renderRules();

    await user.click(await screen.findByRole('switch', { name: 'Closed issues go to Done on' }));
    await waitForMutationsIdle(client);

    expect(sent.find(request => request.method === 'PATCH')?.body).toEqual({ enabled: false, expectedRevision: 1 });
    expect(
      await within(lane('Issue closed').getByRole('listitem', { name: 'Closed issues go to Done' })).findByText(
        'Off, skipped',
      ),
    ).toBeVisible();
  });

  it('shows a member the rules without anything to change them', async () => {
    serveRules({ rules: [bugs(), closed()], canEdit: false });
    renderRules();

    await screen.findByRole('region', { name: OPENED });
    expect(screen.queryByRole('button', { name: 'Add rule' })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('says so when the board is not installed', async () => {
    serveRules({ rules: [] });
    renderRules('gone');

    expect(await screen.findByText('This board isn’t installed.')).toBeVisible();
  });
});
