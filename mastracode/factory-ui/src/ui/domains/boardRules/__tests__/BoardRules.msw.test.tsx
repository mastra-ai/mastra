import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { listedRepository } from '../../../../../e2e/ui/factory-projects';
import { server } from '../../../../../e2e/ui/msw-server';
import { renderWithProviders, waitForMutationsIdle } from '../../../../../e2e/ui/render';
import { BoardRules } from '../components/BoardRules';
import { FACTORY_ID, PROJECT_URL, rule, ruleId, serveRules } from './fixtures/rulesServer';

const OPENED = 'Issue opened';

function renderRules(boardId = 'work', search = '') {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/work/rules${search}`]}>
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
  it('shows each trigger as a lane, new items first, framed by the boards asked before and after this one', async () => {
    serveRules({
      rules: [bugs(), everythingElse(), rule({ id: ruleId('late'), name: 'Never checked' }), closed()],
      order: ['release', 'work'],
    });
    renderRules();

    const regions = await screen.findAllByRole('region');
    expect(regions[0]).toHaveAccessibleName('New issues and pull requests');
    expect(regions[1]).toHaveAccessibleName(OPENED);
    expect(ruleNames(OPENED)).toEqual(['Bugs go to Triage', 'Everything else goes to Intake', 'Never checked']);
    expect(ruleNames('Issue closed')).toEqual(['Closed issues go to Done']);
    const chain = within(await screen.findByRole('list', { name: 'Intake order' }));
    expect(chain.getAllByRole('listitem').map(item => item.textContent)).toEqual([
      'Release Preview',
      'Work',
      'Not routed',
    ]);
    expect(chain.getByText('Work')).toHaveAttribute('aria-current', 'step');
    expect(chain.getByRole('link', { name: 'Release Preview' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/boards/release/rules`,
    );
    expect(screen.getByRole('link', { name: 'Reorder' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/work/intake#intake-order`,
    );
    expect(
      within(lane(OPENED).getByRole('listitem', { name: 'Never checked' })).getByText(
        'Never reached: rule 2 above matches every new issue.',
      ),
    ).toBeVisible();
    expect(lane('Issue reopened').getByText('No rules: the card stays where it is')).toBeVisible();
  });

  it('ends the pull request lane at a rule testing only the kind for pull requests only, as cards still move below it', async () => {
    const PRS = 'Pull request opened';
    const kind = { field: 'source.kind', operator: 'equals' as const, value: 'pull_request' };
    serveRules({
      rules: [
        rule({
          id: ruleId('prs'),
          name: 'Pull requests go to Review',
          on: ['pull_request.opened'],
          when: { operator: 'AND', conditions: [kind] },
        }),
        rule({
          id: ruleId('linked'),
          name: 'Trusted pull requests take a waiting issue to Review',
          on: ['pull_request.opened'],
          when: { operator: 'AND', conditions: [{ field: 'closedIssue.phase', operator: 'in', value: ['intake'] }] },
        }),
        rule({
          id: ruleId('trusted'),
          name: 'Trusted authors go to Review',
          on: ['pull_request.opened'],
          when: { operator: 'AND', conditions: [{ field: 'pullRequest.trusted', operator: 'equals', value: true }] },
        }),
        rule({
          id: ruleId('drafts'),
          name: 'Draft pull requests wait',
          on: ['pull_request.opened'],
          when: { operator: 'AND', conditions: [kind, { field: 'item.labels', operator: 'contains', value: 'draft' }] },
        }),
      ],
    });
    renderRules();

    await screen.findByRole('region', { name: PRS });
    const row = (name: string) => within(lane(PRS).getByRole('listitem', { name }));
    // On pull_request.opened these rules also move the issue cards a pull request links to or was opened from, and
    // those cards are issues, so rule 1 only hides rules that need a pull request too.
    expect(
      row('Trusted pull requests take a waiting issue to Review').queryByText(/Never reached/),
    ).not.toBeInTheDocument();
    expect(row('Trusted authors go to Review').queryByText(/Never reached/)).not.toBeInTheDocument();
    expect(
      row('Draft pull requests wait').getByText('Never reached: rule 1 above matches every pull request.'),
    ).toBeVisible();
  });

  it('leaves a new card-move rule below a rule taking only pull requests, so it doesn’t start filing them', async () => {
    const PRS = 'Pull request opened';
    serveRules({
      rules: [
        rule({
          id: ruleId('prs'),
          name: 'Pull requests go to Review',
          on: ['pull_request.opened'],
          when: { operator: 'AND', conditions: [{ field: 'source.kind', operator: 'equals', value: 'pull_request' }] },
        }),
      ],
    });
    const user = userEvent.setup();
    const { client } = renderRules();

    await screen.findByRole('region', { name: PRS });
    await user.click(lane(PRS).getByRole('button', { name: 'Add rule' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Add rule' }));
    await user.click(dialog.getByRole('radio', { name: /Every new one/ }));
    await user.click(dialog.getByRole('button', { name: 'Continue' }));
    await user.click(dialog.getByRole('radio', { name: 'Planning' }));
    const name = dialog.getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Issues with a pull request go to Planning');
    await user.click(dialog.getByRole('button', { name: 'Create rule' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitForMutationsIdle(client);
    await waitFor(() =>
      expect(ruleNames(PRS)).toEqual(['Pull requests go to Review', 'Issues with a pull request go to Planning']),
    );
  });

  it('finds the rule that hides one even past a kind-only rule, warning and placing a new rule above it', async () => {
    const PRS = 'Pull request opened';
    serveRules({
      rules: [
        rule({
          id: ruleId('prs'),
          name: 'Pull requests go to Review',
          on: ['pull_request.opened'],
          when: { operator: 'AND', conditions: [{ field: 'source.kind', operator: 'equals', value: 'pull_request' }] },
        }),
        rule({ id: ruleId('rest'), name: 'Everything else goes to Planning', on: ['pull_request.opened'] }),
        rule({ id: ruleId('late'), name: 'Late catch-all', on: ['pull_request.opened'] }),
      ],
    });
    const user = userEvent.setup();
    const { client } = renderRules();

    await screen.findByRole('region', { name: PRS });
    const row = (name: string) => within(lane(PRS).getByRole('listitem', { name }));
    expect(row('Everything else goes to Planning').queryByText(/Never reached/)).not.toBeInTheDocument();
    expect(row('Late catch-all').getByText('Never reached: rule 2 above matches every pull request.')).toBeVisible();

    await user.click(lane(PRS).getByRole('button', { name: 'Add rule' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Add rule' }));
    await user.click(dialog.getByRole('radio', { name: /Every new one/ }));
    await user.click(dialog.getByRole('button', { name: 'Continue' }));
    await user.click(dialog.getByRole('radio', { name: 'Planning' }));
    const name = dialog.getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'New catch-all');
    await user.click(dialog.getByRole('button', { name: 'Create rule' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitForMutationsIdle(client);
    await waitFor(() =>
      expect(ruleNames(PRS)).toEqual([
        'Pull requests go to Review',
        'New catch-all',
        'Everything else goes to Planning',
        'Late catch-all',
      ]),
    );
  });

  it('marks a pull request opened rule from 0.28 as moving cards only, so it hides no rule filing pull requests', async () => {
    const PRS = 'Pull request opened';
    serveRules({
      rules: [
        {
          ...rule({ id: ruleId('old'), name: 'Opened pull requests move their card', on: ['pull_request.opened'] }),
          pullRequestOpenedMovesOnly: true,
        },
        rule({ id: ruleId('file'), name: 'Pull requests go to Review', on: ['pull_request.opened'] }),
      ],
    });
    renderRules();

    await screen.findByRole('region', { name: PRS });
    const row = (name: string) => within(lane(PRS).getByRole('listitem', { name }));
    expect(
      row('Opened pull requests move their card').getByText('Moves cards only: files no new pull requests'),
    ).toBeVisible();
    expect(row('Pull requests go to Review').queryByText(/Never reached/)).not.toBeInTheDocument();
    expect(row('Pull requests go to Review').queryByText(/Moves cards only/)).not.toBeInTheDocument();
  });

  it('keeps the rule open now when an earlier rule’s save finishes after it was closed', async () => {
    const pending: (() => void)[] = [];
    serveRules({ rules: [bugs(), everythingElse()] });
    const user = userEvent.setup();
    const { client } = renderRules();
    await screen.findByRole('region', { name: OPENED });
    server.use(
      http.patch(`${PROJECT_URL}/intake-routes/:id`, async () => {
        await new Promise<void>(resolve => pending.push(resolve));
        return HttpResponse.json({ error: 'revision_mismatch', message: 'Changed.' }, { status: 409 });
      }),
    );

    await user.click(lane(OPENED).getByRole('button', { name: 'Edit conditions of Bugs go to Triage' }));
    let dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: /Review/ }));
    await user.click(dialog.getByRole('button', { name: 'Save rule' }));
    await waitFor(() => expect(pending).toHaveLength(1));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(lane(OPENED).getByRole('button', { name: 'Edit conditions of Everything else goes to Intake' }));
    dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: /Review/ }));
    pending[0]?.();
    await waitForMutationsIdle(client);
    await new Promise(resolve => setTimeout(resolve, 200));

    // The first rule's conflict belongs to its own closed session: this one keeps its rule and shows no error.
    const open = within(screen.getByRole('dialog'));
    expect(open.getByRole('textbox', { name: 'Name' })).toHaveValue('Everything else goes to Intake');
    expect(open.queryByText(/Someone else changed this rule first/)).not.toBeInTheDocument();
  });

  it('groups lanes by who reaches them: new items offered to every board, then cards already on this board', async () => {
    serveRules({ rules: [bugs(), closed()], order: ['release', 'work'] });
    renderRules();

    const section = (name: string) => within(screen.getByRole('region', { name }));
    const lanesIn = (name: string) =>
      section(name)
        .getAllByRole('region')
        .map(region => region.getAttribute('aria-label'));
    await screen.findByRole('region', { name: 'New issues and pull requests' });
    expect(lanesIn('New issues and pull requests')).toEqual(['Issue opened', 'Pull request opened']);
    expect(lanesIn('Cards on this board')).toEqual([
      'Issue reopened',
      'Issue labels or assignees change',
      'Issue closed',
      'Pull request reopened',
      'Pull request labels or assignees change',
      'Pull request gets new commits',
      'Review requested',
      'Pull request merged',
      'Pull request closed unmerged',
    ]);
    expect(
      lane('Pull request opened').getByText(
        'A GitHub pull request or GitLab merge request arrives. It joins the card of the issue it closes, or gets a card of its own.',
      ),
    ).toBeVisible();
    const githubOnly = ['Pull request reopened', 'Review requested'];
    for (const name of [...lanesIn('New issues and pull requests'), ...lanesIn('Cards on this board')]) {
      expect(lane(name!).queryByText('GitHub only') !== null, name!).toBe(githubOnly.includes(name!));
    }
    expect(await section('New issues and pull requests').findByRole('list', { name: 'Intake order' })).toBeVisible();
    expect(section('Cards on this board').queryByRole('list', { name: 'Intake order' })).not.toBeInTheDocument();
    expect(
      section('Cards on this board').getByText('Only cards already on this board; other boards never see them.'),
    ).toBeVisible();
  });

  it('draws no intake order while intake still files new issues and pull requests by the old route list', async () => {
    serveRules({ rules: [bugs()], evaluator: 'route-list', order: ['release', 'work'] });
    renderRules();

    expect(
      await screen.findByText('Intake still files new issues and pull requests by the old route list, not by board.'),
    ).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Intake order' })).not.toBeInTheDocument();
    expect(lane(OPENED).getByText('Otherwise: the old route list decides')).toBeVisible();
  });

  it('shows a rule on the old opened event in both arrival lanes, marked legacy, and keeps its event on edit', async () => {
    const { sent } = serveRules({
      rules: [{ ...rule({ id: ruleId('legacy'), name: 'Old intake rule' }), on: ['work_item.created'] }],
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

  it('says a new item on the last board in intake order goes to Not routed', async () => {
    serveRules({ rules: [bugs()], order: ['release', 'work'] });
    renderRules();

    await screen.findByRole('region', { name: OPENED });
    expect(await lane(OPENED).findByText('Otherwise: Not routed')).toBeVisible();
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
    expect(checkboxes('New issues and pull requests')).toHaveLength(2);
    expect(checkboxes('New issues and pull requests')[0]).toContain('Issue opened');
    expect(checkboxes('Cards on this board')).toHaveLength(9);
    expect(checkboxes('Cards on this board').filter(text => text?.endsWith('GitHub only'))).toEqual([
      'Pull request reopenedA closed pull request is opened again.GitHub only',
      'Review requestedA reviewer is requested on the card’s pull request.GitHub only',
    ]);
    expect(checkboxes('New issues and pull requests')[1]).toContain(
      'Pull request openedA GitHub pull request or GitLab merge request arrives. It joins the card of the issue it closes, or gets a card of its own.',
    );
  });

  it('names the board an item no rule here takes goes on to, then Not routed', async () => {
    serveRules({ rules: [bugs()], order: ['work', 'release'] });
    renderRules();

    const footer = 'Otherwise: Release Preview is asked next';
    await screen.findByRole('region', { name: OPENED });
    expect(await lane(OPENED).findByText(footer)).toBeVisible();
    expect(lane('Pull request opened').getByText(footer)).toBeVisible();
    expect(lane('Issue reopened').queryByText(footer)).not.toBeInTheDocument();
  });

  it('shows another board’s rule moving cards here in its lane, linked to where it is edited', async () => {
    const toRelease = rule({
      name: 'Labelled releases go to Release Preview',
      on: ['work_item.updated'],
      when: { operator: 'AND', conditions: [{ field: 'item.labels', operator: 'equals', value: 'release' }] },
      target: { boardKey: 'work', phaseKey: 'queued', joinClosedIssue: false, moveToBoardKey: 'release' },
    });
    serveRules({ rules: [toRelease] });
    renderRules('release');

    const changed = 'Issue labels or assignees change';
    await screen.findByRole('region', { name: changed });
    const from = within(await lane(changed).findByRole('region', { name: 'From other boards' }));
    const link = from.getByRole('link', { name: 'Labelled releases go to Release Preview, on Work' });
    expect(link).toHaveAttribute('href', `/factories/${FACTORY_ID}/work/rules`);
    expect(link).toHaveTextContent('Queued');
    expect(lane(changed).getByText('No rules: this board’s cards stay where they are')).toBeVisible();
    expect(lane(changed).queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();
    expect(lane('Issue closed').queryByRole('region', { name: 'From other boards' })).not.toBeInTheDocument();
  });

  it('narrows to the rules moving cards into one phase, keeping their numbers, with a way back to every rule', async () => {
    const toTriage = rule({ ...bugs(), name: 'Bugs go to Triage' });
    const toIntake = rule({ name: 'Everything else goes to Intake', target: { ...bugs().target, phaseKey: 'intake' } });
    const closed = rule({
      name: 'Closed issues go to Done',
      on: ['work_item.closed'],
      target: { ...bugs().target, phaseKey: 'done' },
    });
    serveRules({ rules: [toTriage, toIntake, closed] });
    renderRules('work', '?into=intake');

    expect(await screen.findByText('Only the rule moving cards into Intake.')).toBeVisible();
    expect(ruleNames(OPENED)).toEqual(['Everything else goes to Intake']);
    expect(lane(OPENED).getByText('2')).toBeVisible();
    expect(lane(OPENED).queryByRole('button', { name: 'Add rule' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Issue closed' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Cards on this board' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Show all' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/work/rules`,
    );
  });

  it('narrows to the rules sending cards to other boards', async () => {
    const toTriage = rule({ ...bugs(), name: 'Bugs go to Triage' });
    const toRelease = rule({
      name: 'Labelled releases go to Release Preview',
      on: ['work_item.updated'],
      target: { boardKey: 'work', phaseKey: 'queued', joinClosedIssue: false, moveToBoardKey: 'release' },
    });
    serveRules({ rules: [toTriage, toRelease] });
    renderRules('work', '?leaving');

    expect(await screen.findByText('Only the rule sending cards to other boards.')).toBeVisible();
    expect(ruleNames('Issue labels or assignees change')).toEqual(['Labelled releases go to Release Preview']);
    expect(screen.queryByRole('region', { name: OPENED })).not.toBeInTheDocument();
  });

  it('says no rule moves cards into a phase none reaches', async () => {
    serveRules({ rules: [rule({ ...bugs(), name: 'Bugs go to Triage' })] });
    renderRules('work', '?into=planning');

    expect(await screen.findByText('No rule is moving cards into Planning.')).toBeVisible();
    expect(screen.queryByRole('region', { name: OPENED })).not.toBeInTheDocument();
  });

  it('shows a rule’s name only when it says more than its conditions and target', async () => {
    serveRules({
      rules: [
        rule({ ...bugs(), id: ruleId('repeats'), name: 'When labels has bug, move to Triage' }),
        rule({ name: 'Everything else goes to Intake', target: { ...bugs().target, phaseKey: 'intake' } }),
      ],
    });
    renderRules();

    await screen.findByRole('region', { name: OPENED });
    const repeats = within(await lane(OPENED).findByRole('listitem', { name: 'When labels has bug, move to Triage' }));
    expect(repeats.queryByText('When labels has bug, move to Triage')).not.toBeInTheDocument();
    expect(
      repeats.getByRole('button', { name: 'Edit conditions of When labels has bug, move to Triage' }),
    ).toBeVisible();
    expect(lane(OPENED).getByText('Everything else goes to Intake')).toBeVisible();
  });

  it('adds a rule for new items on this board, above the rule taking everything else', async () => {
    const { sent } = serveRules({ rules: [everythingElse(), closed()] });
    const user = userEvent.setup();
    const { client } = renderRules();

    await screen.findByRole('region', { name: OPENED });
    await user.click(lane(OPENED).getByRole('button', { name: 'Add rule' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Add rule' }));
    await user.click(dialog.getByRole('radio', { name: /Every new one/ }));
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

  it('offers a new-item rule every phase but the finished ones, even one the first phase can’t move to', async () => {
    const { sent } = serveRules({ rules: [everythingElse(), closed()] });
    const user = userEvent.setup();
    const { client } = renderRules();

    await screen.findByRole('region', { name: OPENED });
    await user.click(lane(OPENED).getByRole('button', { name: 'Add rule' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Add rule' }));
    await user.click(dialog.getByRole('radio', { name: /Every new one/ }));
    await user.click(dialog.getByRole('button', { name: 'Continue' }));
    // Intake can't move a card to Building, but a rule may still file one there: the rule's
    // author designs the board. Only the finished phases are out.
    const phases = within(dialog.getByRole('radiogroup', { name: 'Phase' }));
    for (const title of ['Intake', 'Triage', 'Planning', 'Building', 'Review']) {
      expect(phases.getByRole('radio', { name: title })).toBeInTheDocument();
    }
    expect(phases.getAllByRole('radio')).toHaveLength(5);
    expect(phases.queryByRole('radio', { name: 'Done' })).not.toBeInTheDocument();
    expect(phases.queryByRole('radio', { name: 'Canceled' })).not.toBeInTheDocument();
    await user.click(phases.getByRole('radio', { name: 'Building' }));
    const name = dialog.getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'New items go straight to Building');
    await user.click(dialog.getByRole('button', { name: 'Create rule' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitForMutationsIdle(client);
    expect(sent.find(request => request.method === 'POST' && request.path === '')?.body).toMatchObject({
      name: 'New items go straight to Building',
      on: ['work_item.opened'],
      target: { boardKey: 'work', phaseKey: 'execute' },
    });
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

  it('reloads a rule someone else changed first, and saves the retry against their version', async () => {
    const { state, sent } = serveRules({ rules: [closed()] });
    const user = userEvent.setup();
    const { client } = renderRules();

    await screen.findByRole('region', { name: 'Issue closed' });
    const current = state.rules[0];
    if (current) state.rules[0] = { ...current, name: 'Renamed by a teammate', revision: current.revision + 1 };
    await user.click(screen.getByRole('button', { name: 'Edit conditions of Closed issues go to Done' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Edit rule' }));
    await user.click(dialog.getByRole('button', { name: 'Save rule' }));

    // The dialog now shows the teammate's version, so a second Save writes over what they saved, not a stale copy.
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Someone else changed this rule first. It now shows their version; make your change again.',
    );
    const fresh = within(screen.getByRole('dialog', { name: 'Edit rule' }));
    await user.click(fresh.getByRole('button', { name: /Review/ }));
    expect(fresh.getByRole('textbox', { name: 'Name' })).toHaveValue('Renamed by a teammate');
    await user.click(fresh.getByRole('button', { name: 'Save rule' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitForMutationsIdle(client);
    expect(
      sent
        .filter(request => request.method === 'PATCH')
        .map(request => (request.body as { expectedRevision: number }).expectedRevision),
    ).toEqual([1, 2]);
    expect(ruleNames('Issue closed')).toEqual(['Renamed by a teammate']);
  });

  it('lets a rule on a reopened issue send the card to another board, and keeps that board when another event is added', async () => {
    const reopened = rule({
      id: ruleId('reopened'),
      name: 'Reopened go to Release',
      on: ['work_item.reopened'],
      target: { boardKey: 'work', phaseKey: 'queued', joinClosedIssue: false, moveToBoardKey: 'release' },
    });
    const { sent } = serveRules({ rules: [reopened] });
    const user = userEvent.setup();
    const { client } = renderRules();

    await screen.findByRole('region', { name: 'Issue reopened' });
    await user.click(screen.getByRole('button', { name: 'Edit conditions of Reopened go to Release' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Edit rule' }));
    await user.click(dialog.getByRole('button', { name: /Trigger/ }));
    await user.click(dialog.getByRole('checkbox', { name: /Issue labels or assignees change/ }));
    await user.click(dialog.getByRole('button', { name: /Move to/ }));
    expect(dialog.getByRole('radio', { name: 'Release Preview' })).toBeChecked();
    await user.click(dialog.getByRole('button', { name: /Review/ }));
    await user.click(dialog.getByRole('button', { name: 'Save rule' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitForMutationsIdle(client);
    expect(sent.find(request => request.method === 'PATCH')?.body).toMatchObject({
      on: ['work_item.reopened', 'work_item.updated'],
      target: { boardKey: 'work', phaseKey: 'queued', moveToBoardKey: 'release' },
    });
  });

  it('puts a new rule above the catch-all of every lane it listens on', async () => {
    const reopenedAll = rule({
      id: ruleId('reopened-all'),
      name: 'Every reopened card goes to Intake',
      on: ['work_item.reopened'],
    });
    const closedAll = rule({
      id: ruleId('closed-all'),
      name: 'Every closed card goes to Done',
      on: ['work_item.closed'],
    });
    serveRules({ rules: [reopenedAll, closedAll] });
    const user = userEvent.setup();
    const { client } = renderRules();

    const closedLane = within(await screen.findByRole('region', { name: 'Issue closed' }));
    await user.click(closedLane.getByRole('button', { name: 'Add rule' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Add rule' }));
    await user.click(dialog.getByRole('button', { name: /Trigger/ }));
    await user.click(dialog.getByRole('checkbox', { name: /Issue reopened/ }));
    await user.click(dialog.getByRole('button', { name: 'Continue' }));
    await user.click(dialog.getByRole('radio', { name: /Every card/ }));
    await user.click(dialog.getByRole('button', { name: 'Continue' }));
    await user.click(dialog.getByRole('radio', { name: 'Planning' }));
    const name = dialog.getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Back to Planning');
    await user.click(dialog.getByRole('button', { name: 'Create rule' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitForMutationsIdle(client);
    await waitFor(() =>
      expect(ruleNames('Issue reopened')).toEqual(['Back to Planning', 'Every reopened card goes to Intake']),
    );
    expect(ruleNames('Issue closed')).toEqual(['Back to Planning', 'Every closed card goes to Done']);
  });

  it('lets a rule continue once an unfinished condition is dropped by choosing every item', async () => {
    serveRules({ rules: [closed()] });
    const user = userEvent.setup();
    renderRules();

    const closedLane = within(await screen.findByRole('region', { name: 'Issue closed' }));
    await user.click(closedLane.getByRole('button', { name: 'Add rule' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Add rule' }));
    await user.click(dialog.getByRole('radio', { name: /Only ones that match/ }));
    await user.click(dialog.getByRole('button', { name: 'Add condition' }));
    expect(dialog.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await user.click(dialog.getByRole('radio', { name: /Every card/ }));
    await user.click(dialog.getByRole('radio', { name: /Only ones that match/ }));

    expect(dialog.queryByRole('button', { name: 'Remove condition' })).not.toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('filters on the project’s own sources, picking fields A to Z and a pull request as yes or no', async () => {
    serveRules({ rules: [closed()] });
    server.use(
      http.get('*/web/factory/projects', () =>
        HttpResponse.json({
          projects: [
            {
              id: FACTORY_ID,
              name: 'Factory',
              repositories: [listedRepository('repo-1', 'mastra-ai/mastra'), listedRepository('repo-2', 'acme/app')],
            },
          ],
        }),
      ),
    );
    const user = userEvent.setup();
    renderRules();

    const closedLane = within(await screen.findByRole('region', { name: 'Issue closed' }));
    await user.click(closedLane.getByRole('button', { name: 'Add rule' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Add rule' }));
    await user.click(dialog.getByRole('radio', { name: /Only ones that match/ }));
    await user.click(dialog.getByRole('button', { name: 'Add condition' }));

    await user.click(dialog.getByRole('combobox', { name: 'Field' }));
    const fields = (await screen.findAllByRole('option')).map(option => option.textContent ?? '');
    expect(fields).toEqual([...fields].sort((a, b) => a.localeCompare(b)));
    expect(fields).toEqual(expect.arrayContaining(['Source', 'Has pull request']));
    for (const gone of ['State', 'Integration', 'Provider', 'Kind', 'Closed issue has a pull request']) {
      expect(fields).not.toContain(gone);
    }
    await user.click(screen.getByRole('option', { name: 'Has pull request' }));
    await user.click(dialog.getByRole('radio', { name: 'No' }));
    expect(dialog.getByRole('button', { name: 'Continue' })).toBeEnabled();

    await user.click(dialog.getByRole('button', { name: 'Add condition' }));
    await user.click(dialog.getAllByRole('combobox', { name: 'Field' }).at(-1)!);
    await user.click(await screen.findByRole('option', { name: 'Repository, team or project' }));
    await user.click(dialog.getByRole('combobox', { name: 'Value' }));
    await user.keyboard('mas');
    expect(await screen.findByRole('option', { name: 'mastra-ai/mastra' })).toBeVisible();
    expect(screen.queryByRole('option', { name: 'acme/app' })).not.toBeInTheDocument();
  });

  it('picks a board with the arrow keys, as one radio group', async () => {
    serveRules({ rules: [closed()] });
    const user = userEvent.setup();
    renderRules();

    await screen.findByRole('region', { name: 'Issue closed' });
    await user.click(screen.getByRole('button', { name: 'Edit where Closed issues go to Done moves the card' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Edit rule' }));
    const work = dialog.getByRole('radio', { name: 'Work (this board)' });
    expect(work).toBeChecked();
    work.focus();
    await user.keyboard('{ArrowDown}');
    expect(dialog.getByRole('radio', { name: 'Release Preview' })).toBeChecked();
    expect(dialog.getByRole('radio', { name: 'Release Preview' })).toHaveFocus();
  });

  it('does not call rules under a catch-all unreachable when that catch-all is skipped', async () => {
    const broken = rule({
      id: ruleId('broken'),
      name: 'Everything to the old board',
      problems: ['Board "old" is not installed in this project.'],
    });
    serveRules({ rules: [broken, everythingElse()] });
    renderRules();

    await screen.findByRole('region', { name: OPENED });
    const live = within(lane(OPENED).getByRole('listitem', { name: 'Everything else goes to Intake' }));
    expect(live.queryByText(/Never reached/)).not.toBeInTheDocument();
    expect(
      within(lane(OPENED).getByRole('listitem', { name: 'Everything to the old board' })).getByText(
        'Board "old" is not installed in this project.',
      ),
    ).toBeVisible();
  });

  it('closes an open rule when the page moves to another board', async () => {
    serveRules({ rules: [closed()] });
    const user = userEvent.setup();
    const { rerender } = renderRules();

    await screen.findByRole('region', { name: 'Issue closed' });
    await user.click(screen.getByRole('button', { name: 'Edit conditions of Closed issues go to Done' }));
    await screen.findByRole('dialog', { name: 'Edit rule' });
    rerender(
      <MemoryRouter>
        <BoardRules factoryId={FACTORY_ID} boardId="release" />
      </MemoryRouter>,
    );

    await screen.findByRole('region', { name: 'Issue closed' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('warns a rule on a pull request event also matches outside authors, and adds the trusted condition in one click', async () => {
    const pushes = rule({
      id: ruleId('pushes'),
      name: 'Pushes re-review',
      on: ['pull_request.synchronized'],
      target: { boardKey: 'work', phaseKey: 'pr-review', joinClosedIssue: false, moveToBoardKey: null },
    });
    const { sent } = serveRules({ rules: [everythingElse(), pushes] });
    const user = userEvent.setup();
    const { client } = renderRules();

    await screen.findByRole('region', { name: 'Pull request gets new commits' });
    await user.click(screen.getByRole('button', { name: 'Edit conditions of Pushes re-review' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Edit rule' }));
    const warning = 'Also matches pull requests from outside authors.';
    expect(dialog.getByText(warning)).toBeVisible();

    await user.click(dialog.getByRole('button', { name: 'Add: Pull request trusted is yes' }));
    await waitFor(() => expect(dialog.queryByText(warning)).not.toBeInTheDocument());
    await user.click(dialog.getByRole('button', { name: 'Save rule' }));
    await waitForMutationsIdle(client);

    expect(sent.find(request => request.method === 'PATCH')?.body).toMatchObject({
      when: { operator: 'AND', conditions: [{ field: 'pullRequest.trusted', operator: 'equals', value: true }] },
      expectedRevision: pushes.revision,
    });
  });

  it('keeps the outside-author warning off rules on issue events and off older gated rules', async () => {
    const gated = rule({
      id: ruleId('gated'),
      name: 'Requested reviews go to Review',
      on: ['pull_request.review_requested'],
      target: { boardKey: 'work', phaseKey: 'pr-review', joinClosedIssue: false, moveToBoardKey: null },
      outsiderPullRequestsGated: true,
    });
    serveRules({ rules: [closed(), gated] });
    const user = userEvent.setup();
    renderRules();

    const warning = 'Also matches pull requests from outside authors.';
    await screen.findByRole('region', { name: 'Issue closed' });
    await user.click(screen.getByRole('button', { name: 'Edit conditions of Closed issues go to Done' }));
    expect(within(screen.getByRole('dialog')).queryByText(warning)).not.toBeInTheDocument();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));

    // The older rule still skips outsiders, so the builder has nothing to warn about.
    await user.click(screen.getByRole('button', { name: 'Edit conditions of Requested reviews go to Review' }));
    expect(within(screen.getByRole('dialog')).queryByText(warning)).not.toBeInTheDocument();
  });

  it("notes an older rule skips outside authors' pull requests, and lets them match on request", async () => {
    const pushes = rule({
      id: ruleId('pushes'),
      name: 'Pushes re-review',
      on: ['pull_request.synchronized'],
      target: { boardKey: 'work', phaseKey: 'pr-review', joinClosedIssue: false, moveToBoardKey: null },
      outsiderPullRequestsGated: true,
    });
    const { sent } = serveRules({ rules: [pushes] });
    const user = userEvent.setup();
    const { client } = renderRules();

    const item = within(
      await within(await screen.findByRole('region', { name: 'Pull request gets new commits' })).findByRole(
        'listitem',
        { name: 'Pushes re-review' },
      ),
    );
    expect(item.getByText(/Skips outside authors. pull requests \(older rule\)/)).toBeVisible();

    await user.click(item.getByRole('button', { name: 'Let outside authors match' }));
    await waitForMutationsIdle(client);

    expect(sent.find(request => request.method === 'PATCH')?.body).toEqual({
      outsiderPullRequestsGated: false,
      expectedRevision: 1,
    });
    await waitFor(() =>
      expect(
        within(screen.getByRole('listitem', { name: 'Pushes re-review' })).queryByText(/older rule/),
      ).not.toBeInTheDocument(),
    );
  });

  it("hides the older-rule note once the rule's own conditions test the pull request's trust", async () => {
    serveRules({
      rules: [
        rule({
          id: ruleId('gated-trusting'),
          name: 'Trusted pushes re-review',
          on: ['pull_request.synchronized'],
          when: { operator: 'AND', conditions: [{ field: 'pullRequest.trusted', operator: 'equals', value: true }] },
          target: { boardKey: 'work', phaseKey: 'pr-review', joinClosedIssue: false, moveToBoardKey: null },
          outsiderPullRequestsGated: true,
        }),
      ],
    });
    renderRules();

    await screen.findByRole('region', { name: 'Pull request gets new commits' });
    expect(screen.queryByText(/older rule/)).not.toBeInTheDocument();
  });

  it('keeps rules under an older gated rule reachable, as outside authors’ pull requests fall through it', async () => {
    const PUSHES = 'Pull request gets new commits';
    const target = { boardKey: 'work', phaseKey: 'pr-review', joinClosedIssue: false, moveToBoardKey: null };
    serveRules({
      rules: [
        rule({
          id: ruleId('gated-all'),
          name: 'Pushes re-review',
          on: ['pull_request.synchronized'],
          when: null,
          target,
          outsiderPullRequestsGated: true,
        }),
        rule({
          id: ruleId('below-gated'),
          name: 'Docs pushes wait in Triage',
          on: ['pull_request.synchronized'],
          when: { operator: 'AND', conditions: [{ field: 'item.labels', operator: 'contains', value: 'docs' }] },
          target: { ...target, phaseKey: 'triage' },
        }),
        rule({
          id: ruleId('gated-below-gated'),
          name: 'Old docs pushes re-review',
          on: ['pull_request.synchronized'],
          when: { operator: 'AND', conditions: [{ field: 'item.labels', operator: 'contains', value: 'docs' }] },
          target,
          outsiderPullRequestsGated: true,
        }),
        rule({
          id: ruleId('closed-all'),
          name: 'Closed pull requests cancel',
          on: ['pull_request.closed'],
          when: null,
          target: { ...target, phaseKey: 'canceled' },
          outsiderPullRequestsGated: true,
        }),
        rule({
          id: ruleId('below-closed'),
          name: 'Closed docs cancel too',
          on: ['pull_request.closed'],
          when: { operator: 'AND', conditions: [{ field: 'item.labels', operator: 'contains', value: 'docs' }] },
          target: { ...target, phaseKey: 'canceled' },
        }),
      ],
    });
    renderRules();

    await screen.findByRole('region', { name: PUSHES });
    // The gated rule skips outside authors' pull requests, so the rule below still catches those.
    expect(
      within(lane(PUSHES).getByRole('listitem', { name: 'Docs pushes wait in Triage' })).queryByText(/Never reached/),
    ).not.toBeInTheDocument();
    // A gated rule below it skips the same pull requests: trusted ones stop at the catch-all,
    // outside authors' fall through both, so nothing ever reaches it.
    expect(
      within(lane(PUSHES).getByRole('listitem', { name: 'Old docs pushes re-review' })).getByText(
        'Never reached: rule 1 above matches every card.',
      ),
    ).toBeVisible();
    // Closing settles the pull request whoever wrote it: there the gate holds nothing back.
    expect(
      within(lane('Pull request closed unmerged').getByRole('listitem', { name: 'Closed docs cancel too' })).getByText(
        'Never reached: rule 1 above matches every card.',
      ),
    ).toBeVisible();
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
