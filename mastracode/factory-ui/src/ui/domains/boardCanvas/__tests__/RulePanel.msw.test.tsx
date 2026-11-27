import { FACTORY_ROUTE_CONTRACTS } from '@mastra/factory/routes/contracts';
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../e2e/ui/msw-server';
import { renderWithProviders, waitForMutationsIdle } from '../../../../../e2e/ui/render';
import type { IntakeDryRunResponse, IntakeRouteInfo, IntakeTestResponse } from '../../../../api/types';
import type { CanvasFocus } from '../../boardConfig/boardConfigPaths';
import { FACTORY_ID, PROJECT_URL, rule, ruleId, serveRules } from '../../boardRules/__tests__/fixtures/rulesServer';
import { RulePanel } from '../components/rulePanel/RulePanel';

type RuleStats = IntakeDryRunResponse['boards'][number]['rules'][number];

const bugs = () =>
  rule({
    id: ruleId('bugs'),
    name: 'Bugs go to Triage',
    when: { operator: 'AND', conditions: [{ field: 'item.labels', operator: 'contains', value: 'bug' }] },
    target: { boardKey: 'work', phaseKey: 'triage', joinClosedIssue: false, moveToBoardKey: null },
  });
const everythingElse = () => rule({ id: ruleId('everything'), name: 'Everything else goes to Intake' });
const closed = (fields: Partial<IntakeRouteInfo> = {}) =>
  rule({
    id: ruleId('closed'),
    name: 'Closed issues go to Done',
    on: ['work_item.closed'],
    target: { boardKey: 'work', phaseKey: 'done', joinClosedIssue: false, moveToBoardKey: null },
    ...fields,
  });
const pushes = (fields: Partial<IntakeRouteInfo> = {}) =>
  rule({
    id: ruleId('pushes'),
    name: 'Pushes re-review',
    on: ['pull_request.synchronized'],
    target: { boardKey: 'work', phaseKey: 'pr-review', joinClosedIssue: false, moveToBoardKey: null },
    ...fields,
  });

/** The project's dry run over its newest items: each work rule's stats, and how many items an unsaved draft moves. */
function serveDryRun(rules: () => IntakeRouteInfo[], stats: Record<string, Partial<RuleStats>> = {}) {
  const drafts: unknown[] = [];
  server.use(
    http.post(`${PROJECT_URL}/intake/dry-run`, async ({ request }) => {
      const raw: unknown = await request.json();
      const body = FACTORY_ROUTE_CONTRACTS.intakeDryRun.bodySchema.parse(raw);
      if (body.boards) drafts.push(raw);
      const boardRules = (boardKey: string) =>
        rules()
          .filter(entry => entry.target.boardKey === boardKey)
          .map(entry => ({
            routeId: entry.id,
            name: entry.name,
            enabled: entry.enabled,
            takes: [],
            lost: [],
            filed: 0,
            ...stats[entry.id],
          }));
      return HttpResponse.json({
        evaluator: 'intake-order',
        sampled: 200,
        boards: [
          { boardKey: 'work', name: 'Work', takes: [], lostTo: [], rules: boardRules('work') },
          { boardKey: 'release', name: 'Release Preview', takes: [], lostTo: [], rules: boardRules('release') },
        ],
        notRouted: [],
        ...(body.boards ? { changed: 4 } : {}),
        items: [],
        canEdit: true,
      } satisfies IntakeDryRunResponse);
    }),
  );
  return drafts;
}

/** The canvas around the panel: it follows the panel to another rule, back to a test, or closes it. */
function Canvas({ initial, backTo }: { initial: CanvasFocus; backTo?: string }) {
  const [focus, setFocus] = useState<CanvasFocus | undefined>(initial);
  if (!focus) return <p>Panel closed</p>;
  if ('test' in focus && !('rule' in focus)) return <p>Testing {focus.test}</p>;
  return (
    <RulePanel
      factoryId={FACTORY_ID}
      boardId="work"
      focus={'rule' in focus ? { rule: focus.rule } : focus}
      backTo={backTo}
      onFocus={setFocus}
      onClose={() => setFocus(undefined)}
    />
  );
}

function renderPanel(initial: CanvasFocus, backTo?: string) {
  return renderWithProviders(
    <MemoryRouter>
      <Canvas initial={initial} backTo={backTo} />
      <Toaster />
    </MemoryRouter>,
  );
}

/** The rules a trigger checks, top to bottom, as the panel lists them. */
function order(trigger: string) {
  return within(screen.getByRole('region', { name: trigger })).getAllByRole('listitem');
}

async function pick(combobox: string, option: string | RegExp) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name: combobox }));
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('Rule panel', () => {
  it('creates a rule for new items named after what it does, then shows it above the rule taking everything else', async () => {
    const { state, sent } = serveRules({ rules: [everythingElse(), closed()] });
    serveDryRun(() => state.rules);
    const user = userEvent.setup();
    const { client } = renderPanel({ newRule: { on: 'work_item.opened', into: 'planning', board: 'work' } });

    const name = await screen.findByRole('textbox', { name: 'Name' });
    expect(name).toHaveValue('When issue opened, move to Planning');
    // An item with no card yet can only land on this board, so its phases are all the list offers.
    expect(screen.queryByRole('combobox', { name: 'Board' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Phase' }));
    expect(await screen.findByRole('option', { name: 'Triage' })).toBeVisible();
    expect(screen.queryByRole('option', { name: 'Release Preview' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.clear(name);
    await user.type(name, 'New items go to Planning');
    await user.click(screen.getByRole('button', { name: 'Create rule' }));

    expect(await screen.findByRole('switch', { name: 'New items go to Planning on' })).toBeChecked();
    await waitForMutationsIdle(client);
    expect(sent.find(request => request.method === 'POST' && request.path === '')?.body).toMatchObject({
      name: 'New items go to Planning',
      on: ['work_item.opened'],
      when: null,
      target: { boardKey: 'work', phaseKey: 'planning' },
    });
    expect(order('Issue opened')[0]).toHaveAttribute('aria-current', 'true');
    expect(order('Issue opened')).toHaveLength(2);
  });

  it('puts a new rule above the catch-all of every trigger it listens on', async () => {
    const reopenedAll = rule({ id: ruleId('reopened-all'), name: 'Every reopened card', on: ['work_item.reopened'] });
    const closedAll = rule({ id: ruleId('closed-all'), name: 'Every closed card', on: ['work_item.closed'] });
    const { state, sent } = serveRules({ rules: [reopenedAll, closedAll] });
    serveDryRun(() => state.rules);
    const user = userEvent.setup();
    const { client } = renderPanel({ newRule: { on: 'work_item.closed', board: 'work' } });

    await user.click(await screen.findByRole('button', { name: 'When' }));
    await user.click(await screen.findByRole('menuitemcheckbox', { name: /Issue reopened/ }));
    await user.keyboard('{Escape}');
    await pick('Phase', 'Planning');
    const name = screen.getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Back to Planning');
    await user.click(screen.getByRole('button', { name: 'Create rule' }));

    await screen.findByRole('switch', { name: 'Back to Planning on' });
    await waitForMutationsIdle(client);
    expect(sent.filter(request => request.method === 'POST' && request.path === '')).toHaveLength(1);
    expect(sent.find(request => request.path === '/reorder')?.body).toMatchObject({ boardKey: 'work' });
    expect(state.rules.map(entry => entry.name)).toEqual([
      'Back to Planning',
      'Every reopened card',
      'Every closed card',
    ]);
  });

  it('sends a card-move rule’s cards to another board, keeping the rule on this one and how it joins closed issues', async () => {
    const { state, sent } = serveRules({ rules: [closed({ target: { ...closed().target, joinClosedIssue: true } })] });
    serveDryRun(() => state.rules);
    const user = userEvent.setup();
    const { client } = renderPanel({ rule: ruleId('closed') });

    await screen.findByRole('switch', { name: 'Closed issues go to Done on' });
    await pick('Phase', 'Release Preview');
    expect(screen.getByRole('combobox', { name: 'Board' })).toHaveTextContent('Release Preview');
    await pick('Board', 'Work (this board)');
    expect(screen.queryByRole('combobox', { name: 'Board' })).not.toBeInTheDocument();
    await pick('Phase', 'Release Preview');
    await pick('Phase', 'Shipping');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument());
    await waitForMutationsIdle(client);
    expect(sent.find(request => request.method === 'PATCH')?.body).toMatchObject({
      target: { boardKey: 'work', phaseKey: 'shipping', moveToBoardKey: 'release', joinClosedIssue: true },
      expectedRevision: 1,
    });
    expect(screen.getByRole('combobox', { name: 'Phase' })).toHaveTextContent('Shipping');
  });

  it('edits a condition in its cell, and saves the new value', async () => {
    const flaky = rule({
      id: ruleId('flaky'),
      name: 'Flaky tests go to Triage',
      when: { operator: 'AND', conditions: [{ field: 'item.title', operator: 'contains', value: 'flaky' }] },
      target: { boardKey: 'work', phaseKey: 'triage', joinClosedIssue: false, moveToBoardKey: null },
    });
    const { state, sent } = serveRules({ rules: [flaky, everythingElse()] });
    serveDryRun(() => state.rules);
    const user = userEvent.setup();
    const { client } = renderPanel({ rule: ruleId('flaky') });

    await user.click(await screen.findByRole('button', { name: 'Edit condition: Title contains flaky' }));
    const value = screen.getByRole('textbox', { name: 'Value' });
    await user.clear(value);
    await user.type(value, 'flake');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitForMutationsIdle(client);

    expect(sent.find(request => request.method === 'PATCH')?.body).toMatchObject({
      when: { operator: 'AND', conditions: [{ field: 'item.title', operator: 'contains', value: 'flake' }] },
      expectedRevision: 1,
    });
    expect(await screen.findByRole('button', { name: 'Edit condition: Title contains flake' })).toBeVisible();
  });

  describe('when a condition is added', () => {
    it('then a rule not on closed issues offers no close reason', async () => {
      const { state } = serveRules({ rules: [closed(), pushes()] });
      serveDryRun(() => state.rules);
      const user = userEvent.setup();
      renderPanel({ rule: ruleId('pushes') });

      await user.click(await screen.findByRole('button', { name: 'Add condition' }));
      await user.click(screen.getByRole('combobox', { name: 'Field' }));

      expect(await screen.findByRole('option', { name: 'Title' })).toBeVisible();
      expect(screen.queryByRole('option', { name: 'Close reason' })).not.toBeInTheDocument();
    });

    it('then a rule on closed issues saves the close reason picked', async () => {
      const { state, sent } = serveRules({ rules: [closed(), pushes()] });
      serveDryRun(() => state.rules);
      const user = userEvent.setup();
      const { client } = renderPanel({ rule: ruleId('closed') });

      await user.click(await screen.findByRole('button', { name: 'Add condition' }));
      await pick('Field', 'Close reason');
      await pick('Value', 'Not planned');
      await user.click(screen.getByRole('button', { name: 'Save' }));
      await waitForMutationsIdle(client);

      expect(sent.find(request => request.method === 'PATCH')?.body).toMatchObject({
        when: { operator: 'AND', conditions: [{ field: 'event.reason', operator: 'equals', value: 'canceled' }] },
        expectedRevision: 1,
      });
    });
  });

  it('keeps the edit with the server’s reason when a rule doesn’t save', async () => {
    const { state } = serveRules({ rules: [closed()] });
    serveDryRun(() => state.rules);
    server.use(
      http.patch(`${PROJECT_URL}/intake-routes/:routeId`, () =>
        HttpResponse.json({ error: 'unknown_board', message: 'Board "release" is not installed.' }, { status: 422 }),
      ),
    );
    const user = userEvent.setup();
    renderPanel({ rule: ruleId('closed') });

    await screen.findByRole('switch', { name: 'Closed issues go to Done on' });
    await pick('Phase', 'Planning');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Board "release" is not installed.');
    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  it('reloads a rule someone else changed first, and saves the retry against their version', async () => {
    const { state, sent } = serveRules({ rules: [closed()] });
    serveDryRun(() => state.rules);
    const user = userEvent.setup();
    const { client } = renderPanel({ rule: ruleId('closed') });

    const name = await screen.findByRole('textbox', { name: 'Name' });
    const current = state.rules[0];
    if (current) state.rules[0] = { ...current, name: 'Renamed by a teammate', revision: current.revision + 1 };
    await user.type(name, '!');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // The panel now shows the teammate's version, so the next Save writes over what they saved, not a stale copy.
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Someone else changed this rule first. It now shows their version; make your change again.',
    );
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Renamed by a teammate');
    await user.type(screen.getByRole('textbox', { name: 'Name' }), '!');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument());
    await waitForMutationsIdle(client);
    expect(sent.filter(request => request.method === 'PATCH').map(request => request.body)).toMatchObject([
      { expectedRevision: 1 },
      { expectedRevision: 2, name: 'Renamed by a teammate!' },
    ]);
  });

  it('says how many recent items an unsaved change would move, and forgets it on Discard', async () => {
    const { state } = serveRules({ rules: [bugs(), everythingElse()] });
    const drafts = serveDryRun(() => state.rules);
    const user = userEvent.setup();
    renderPanel({ rule: ruleId('bugs') });

    await screen.findByRole('switch', { name: 'Bugs go to Triage on' });
    await pick('Phase', 'Planning');

    expect(
      await screen.findByText('4 of the last 200 items would now land on a different board or phase.'),
    ).toBeVisible();
    expect(drafts).toMatchObject([
      {
        boards: [
          {
            boardKey: 'work',
            routes: [
              { id: ruleId('bugs'), target: { phaseKey: 'planning' } },
              { id: ruleId('everything'), target: { phaseKey: null } },
            ],
          },
        ],
      },
    ]);
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.queryByText(/would now land/)).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Phase' })).toHaveTextContent('Triage');
  });

  it('re-tests the item the rule was opened from on every change, and goes back to that test', async () => {
    const { state } = serveRules({ rules: [bugs(), everythingElse()] });
    serveDryRun(() => state.rules);
    const subject = 'https://github.com/mastra-ai/mastra/issues/7';
    const tests: unknown[] = [];
    server.use(
      http.post(`${PROJECT_URL}/intake/test`, async ({ request }) => {
        const body = FACTORY_ROUTE_CONTRACTS.intakeTest.bodySchema.parse(await request.json());
        tests.push(body);
        return HttpResponse.json({
          item: { title: 'Crash on start', url: subject, kind: 'fetched', id: null },
          placement: { boardKey: 'work', routeId: ruleId('bugs'), phase: body.boards ? 'planning' : 'triage' },
          reason: null,
          note: null,
          evaluator: 'intake-order',
          boards: [],
          current: null,
          moves: [],
        } satisfies IntakeTestResponse);
      }),
    );
    const user = userEvent.setup();
    renderPanel({ rule: ruleId('bugs') }, subject);

    await screen.findByRole('switch', { name: 'Bugs go to Triage on' });
    await pick('Phase', 'Planning');

    expect(await screen.findByText('Crash on start now goes to Work › Planning')).toBeVisible();
    expect(await screen.findByText('Was Work › Triage')).toBeVisible();
    expect(tests).toContainEqual({ url: subject });
    expect(tests).toContainEqual(expect.objectContaining({ url: subject, boards: [expect.anything()] }));
    await user.click(screen.getByRole('button', { name: 'Back to test' }));
    expect(screen.getByText(`Testing ${subject}`)).toBeVisible();
  });

  it('deletes a rule from its menu and closes', async () => {
    const { state, sent } = serveRules({ rules: [closed()] });
    serveDryRun(() => state.rules);
    const user = userEvent.setup();
    renderPanel({ rule: ruleId('closed') });

    await user.click(await screen.findByRole('button', { name: 'More' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete rule' }));

    expect(await screen.findByText('Panel closed')).toBeVisible();
    expect(await screen.findByText('Deleted “Closed issues go to Done”')).toBeVisible();
    expect(sent).toContainEqual({ method: 'DELETE', path: `/${ruleId('closed')}` });
    expect(state.rules).toEqual([]);
  });

  it('turns a rule off at once, which marks it skipped', async () => {
    const { state, sent } = serveRules({ rules: [closed()] });
    serveDryRun(() => state.rules);
    const user = userEvent.setup();
    const { client } = renderPanel({ rule: ruleId('closed') });

    await user.click(await screen.findByRole('switch', { name: 'Closed issues go to Done on' }));
    await waitForMutationsIdle(client);

    expect(sent.find(request => request.method === 'PATCH')?.body).toEqual({ enabled: false, expectedRevision: 1 });
    expect(await screen.findByText('Off, skipped')).toBeVisible();
  });

  it('moves a card-move rule earlier among this board’s rules only', async () => {
    const merged = pushes({ id: ruleId('merged'), name: 'Merged go to Done' });
    // The opened trigger's rule sits between them and must keep its slot.
    const { state, sent } = serveRules({ rules: [pushes(), everythingElse(), merged] });
    serveDryRun(() => state.rules);
    const user = userEvent.setup();
    const { client } = renderPanel({ rule: ruleId('merged') });

    await screen.findByRole('switch', { name: 'Merged go to Done on' });
    await user.click(within(order('Pull request gets new commits')[1]).getByRole('button', { name: 'Check earlier' }));
    await waitForMutationsIdle(client);

    expect(sent.find(request => request.path === '/reorder')?.body).toEqual({
      boardKey: 'work',
      ids: [ruleId('merged'), ruleId('everything'), ruleId('pushes')],
    });
    await waitFor(() => expect(order('Pull request gets new commits')[0]).toHaveAttribute('aria-current', 'true'));
  });

  it('moves another rule on the trigger from its own row, keeping the open rule in the panel', async () => {
    const merged = pushes({ id: ruleId('merged'), name: 'Merged go to Done' });
    const { state, sent } = serveRules({ rules: [pushes(), everythingElse(), merged] });
    serveDryRun(() => state.rules);
    const user = userEvent.setup();
    const { client } = renderPanel({ rule: ruleId('merged') });

    await screen.findByRole('switch', { name: 'Merged go to Done on' });
    const first = order('Pull request gets new commits')[0];
    expect(within(first).getByRole('button', { name: 'Check earlier' })).toBeDisabled();
    await user.click(within(first).getByRole('button', { name: 'Check later' }));
    await waitForMutationsIdle(client);

    expect(sent.find(request => request.path === '/reorder')?.body).toEqual({
      boardKey: 'work',
      ids: [ruleId('merged'), ruleId('everything'), ruleId('pushes')],
    });
    await waitFor(() => expect(order('Pull request gets new commits')[0]).toHaveAttribute('aria-current', 'true'));
    expect(screen.getByRole('switch', { name: 'Merged go to Done on' })).toBeVisible();
  });

  it('opens another rule from the trigger’s list, and starts a new rule on that trigger', async () => {
    const { state } = serveRules({ rules: [bugs(), everythingElse()] });
    serveDryRun(() => state.rules);
    const user = userEvent.setup();
    renderPanel({ rule: ruleId('bugs') });

    await screen.findByRole('switch', { name: 'Bugs go to Triage on' });
    await user.click(within(order('Issue opened')[1]).getByRole('button', { name: /^2/ }));
    expect(await screen.findByRole('switch', { name: 'Everything else goes to Intake on' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Add rule on Issue opened' }));
    // The trigger comes along; where its items go is for the author to pick, not the board's first phase.
    expect(await screen.findByRole('button', { name: 'Create rule' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'When' })).toHaveTextContent('Issue opened');
    expect(screen.getByRole('combobox', { name: 'Phase' })).toHaveTextContent('Pick a phase');
  });

  it('warns a rule on a pull request event also matches outside authors, and adds the trusted condition in one click', async () => {
    const { state, sent } = serveRules({ rules: [everythingElse(), pushes()] });
    serveDryRun(() => state.rules);
    const user = userEvent.setup();
    const { client } = renderPanel({ rule: ruleId('pushes') });

    const warning = 'Also matches pull requests from outside authors.';
    expect(await screen.findByText(warning)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Add: Pull request trusted is yes' }));
    await waitFor(() => expect(screen.queryByText(warning)).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitForMutationsIdle(client);

    expect(sent.find(request => request.method === 'PATCH')?.body).toMatchObject({
      when: { operator: 'AND', conditions: [{ field: 'pullRequest.trusted', operator: 'equals', value: true }] },
      expectedRevision: 1,
    });
  });

  it("notes an older rule skips outside authors' pull requests, and lets them match on request", async () => {
    const { state, sent } = serveRules({ rules: [pushes({ outsiderPullRequestsGated: true })] });
    serveDryRun(() => state.rules);
    const user = userEvent.setup();
    const { client } = renderPanel({ rule: ruleId('pushes') });

    expect(await screen.findByText(/Skips outside authors. pull requests \(older rule\)/)).toBeVisible();
    expect(screen.queryByText('Also matches pull requests from outside authors.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Let outside authors match' }));
    await waitForMutationsIdle(client);

    expect(sent.find(request => request.method === 'PATCH')?.body).toEqual({
      outsiderPullRequestsGated: false,
      expectedRevision: 1,
    });
    await waitFor(() => expect(screen.queryByText(/older rule/)).not.toBeInTheDocument());
  });

  it('says how often a card-move rule was skipped lately, and links the latest item', async () => {
    const { state } = serveRules({
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
    serveDryRun(() => state.rules);
    renderPanel({ rule: ruleId('closed') });

    expect(
      await screen.findByText('Skipped 3 times in the last 30 days: phase "done" doesn\'t take cards from "triage".'),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Latest: Fix the flaky test' })).toHaveAttribute(
      'href',
      'https://github.com/mastra-ai/mastra/issues/12',
    );
  });

  it('shows what a rule for new items filed and would take, and what other boards took first', async () => {
    const { state } = serveRules({ rules: [bugs(), everythingElse()] });
    serveDryRun(() => state.rules, {
      [ruleId('bugs')]: { filed: 30, takes: ['a', 'b'], lost: [{ boardKey: 'release', keys: ['c'] }] },
    });
    renderPanel({ rule: ruleId('bugs') });

    expect(await screen.findByText('2 landed here')).toBeVisible();
    const stats = Object.fromEntries(
      screen
        .getAllByRole('term')
        .map((term, index) => [term.textContent, screen.getAllByRole('definition')[index]?.textContent]),
    );
    expect(stats).toMatchObject({ 'Filed · 30 days': '30' });
    expect(screen.getByText('1 by Release Preview')).toBeVisible();
  });

  it('shows a member the rule without anything to change it', async () => {
    const { state } = serveRules({ rules: [bugs(), closed()], canEdit: false });
    serveDryRun(() => state.rules);
    renderPanel({ rule: ruleId('bugs') });

    expect(await screen.findByRole('heading', { name: 'Bugs go to Triage' })).toBeVisible();
    const conditions = screen.getByRole('group', { name: 'Conditions' });
    expect(within(conditions).getByText('Labels')).toBeVisible();
    expect(within(conditions).getByText('bug')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Edit condition/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add condition' })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'When' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add rule/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('says so when the rule no longer exists', async () => {
    const { state } = serveRules({ rules: [closed()] });
    serveDryRun(() => state.rules);
    const user = userEvent.setup();
    renderPanel({ rule: ruleId('gone') });

    expect(await screen.findByText('This rule no longer exists.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByText('Panel closed')).toBeVisible();
  });
});
