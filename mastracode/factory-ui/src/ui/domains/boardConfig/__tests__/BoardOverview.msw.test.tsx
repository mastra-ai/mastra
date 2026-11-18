import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../e2e/ui/msw-server';
import { rule, serveRules } from '../../boardRules/__tests__/fixtures/rulesServer';
import { FACTORY_ID, renderAt, serveBoard, stubFactory } from './fixtures/factory-app';
import { storedWorkBoard } from './fixtures/work-board';

const OVERVIEW = `/factories/${FACTORY_ID}/work/config`;
const RULES = `/factories/${FACTORY_ID}/work/rules`;

const outsideAuthors = rule({
  name: 'Outside authors wait in Intake',
  on: ['work_item.opened'],
  when: { operator: 'AND', conditions: [{ field: 'item.trusted', operator: 'equals', value: false }] },
  target: { boardKey: 'work', phaseKey: 'intake', joinClosedIssue: false, moveToBoardKey: null },
});
const duplicates = rule({
  name: 'Duplicates go to Canceled',
  on: ['work_item.closed'],
  when: { operator: 'AND', conditions: [{ field: 'event.reason', operator: 'equals', value: 'canceled' }] },
  target: { boardKey: 'work', phaseKey: 'canceled', joinClosedIssue: false, moveToBoardKey: null },
});
const closed = rule({
  name: 'Closed issues go to Done',
  on: ['work_item.closed'],
  target: { boardKey: 'work', phaseKey: 'done', joinClosedIssue: false, moveToBoardKey: null },
});
const switchedOff = rule({
  name: 'Reopened issues go back to Intake',
  enabled: false,
  on: ['work_item.reopened'],
  target: { boardKey: 'work', phaseKey: 'intake', joinClosedIssue: false, moveToBoardKey: null },
});
const toRelease = rule({
  name: 'Labelled releases go to Release Preview',
  on: ['work_item.updated'],
  when: { operator: 'AND', conditions: [{ field: 'item.labels', operator: 'contains', value: 'release' }] },
  target: { boardKey: 'work', phaseKey: 'queued', joinClosedIssue: false, moveToBoardKey: 'release' },
});
const fromRelease = rule({
  name: 'Shipped releases land in Done',
  on: ['pull_request.merged'],
  target: { boardKey: 'release', phaseKey: 'done', joinClosedIssue: false, moveToBoardKey: 'work' },
});

function labelled(label: string) {
  return {
    operator: 'AND' as const,
    conditions: [{ field: 'item.labels', operator: 'contains' as const, value: label }],
  };
}

function phase(name: string) {
  return within(screen.getByRole('listitem', { name }));
}

describe('Board map', () => {
  it('counts the live rules moving cards into each phase, from this board and others', async () => {
    stubFactory();
    serveBoard(storedWorkBoard());
    serveRules({ rules: [outsideAuthors, duplicates, closed, switchedOff, toRelease, fromRelease] });
    renderAt(OVERVIEW);

    await screen.findByRole('link', { name: '2 rules' });
    expect(phase('Done').getByRole('link', { name: '2 rules' })).toHaveAttribute('href', `${RULES}?into=done`);
    expect(phase('Canceled').getByRole('link', { name: '1 rule' })).toHaveAttribute('href', `${RULES}?into=canceled`);
    expect(phase('Intake').getByRole('link', { name: '1 rule' })).toBeInTheDocument();
    expect(phase('Intake').getByText('New cards start here')).toBeInTheDocument();
    expect(phase('Triage').getByText('No rule moves cards here')).toBeInTheDocument();
    expect(screen.getByText(/cards from here to other boards/)).toHaveTextContent(
      '1 rule sends cards from here to other boards.',
    );
  });

  it('lists the rules behind a count on hover', async () => {
    const user = userEvent.setup();
    stubFactory();
    serveBoard(storedWorkBoard());
    serveRules({ rules: [duplicates, closed, toRelease, fromRelease] });
    renderAt(OVERVIEW);

    await screen.findByRole('listitem', { name: 'Done' });
    await user.hover(await phase('Done').findByRole('link', { name: '2 rules' }));
    const done = within(await screen.findByRole('list', { name: 'Rules that move cards into Done' }));
    expect(done.getAllByRole('listitem').map(item => item.textContent)).toEqual([
      'Issue closedEvery card',
      'Release Preview: Pull request mergedEvery card',
    ]);
    await user.unhover(phase('Done').getByRole('link', { name: '2 rules' }));

    await user.hover(within(screen.getByText(/cards from here to other boards/)).getByRole('link', { name: '1 rule' }));
    const leaving = within(await screen.findByRole('list', { name: 'Rules that send cards to other boards' }));
    expect(leaving.getByRole('listitem')).toHaveTextContent(
      'Issue labels or assignees changeLabels contains releaseTo Release Preview, Queued',
    );
  });

  it('reads each phase top to bottom: who works it, how it ends, where cards go next', async () => {
    stubFactory();
    serveBoard(storedWorkBoard());
    serveRules({ rules: [] });
    renderAt(OVERVIEW);

    const planning = within(await screen.findByRole('listitem', { name: 'Planning' }));
    expect(planning.getByText('factory-plan')).toBeInTheDocument();
    expect(planning.getByText('Started by hand')).toBeInTheDocument();
    expect(planning.getByText('submit_plan')).toBeInTheDocument();
    expect(planning.getByText('Building')).toBeInTheDocument();
    expect(phase('Review').getByText('Record a review verdict')).toBeInTheDocument();
    expect(phase('Done').getByText('Finished')).toBeInTheDocument();
    expect(phase('Done').queryByText('Ends with')).not.toBeInTheDocument();
    expect(phase('Planning').getByRole('link', { name: 'Planning' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/work/config/planning`,
    );
  });

  it('shows what each agent is told on hover, and when it starts or finishes on its own', async () => {
    const user = userEvent.setup();
    const seed = storedWorkBoard().board;
    const phases = seed.phases.map(candidate =>
      candidate.key === 'planning'
        ? {
            ...candidate,
            runner: {
              ...candidate.runner,
              instructions: 'Keep plans under a page.',
              goal: { objective: 'A plan the team approves', maxRuns: 3 },
            },
            exitTool: { id: 'submit_plan', autoApprove: true, autoApproveWhen: labelled('small') },
          }
        : candidate.key === 'triage'
          ? { ...candidate, autoStart: true, autoStartWhen: labelled('bug') }
          : candidate.key === 'pr-review'
            ? { ...candidate, runner: { skill: 'gone-skill' } }
            : candidate,
    );
    stubFactory();
    serveBoard(storedWorkBoard({ phases }));
    serveRules({ rules: [] });
    renderAt(OVERVIEW);

    const planning = within(await screen.findByRole('listitem', { name: 'Planning' }));
    expect(planning.getByText('Approved on its own only if labels contains small')).toBeInTheDocument();
    expect(phase('Triage').getByText('Starts on its own only if labels contains bug')).toBeInTheDocument();
    expect(planning.getByText('Started by hand')).toBeInTheDocument();
    expect(phase('Done').queryByText('Starts')).not.toBeInTheDocument();

    await user.hover(planning.getByRole('link', { name: 'factory-plan' }));
    expect(await screen.findByRole('heading', { name: 'factory-plan' })).toBeInTheDocument();
    expect(screen.getByText('Keep plans under a page.')).toBeInTheDocument();
    expect(screen.getByText('Goal, up to 3 runs')).toBeInTheDocument();
    expect(screen.getByText('A plan the team approves')).toBeInTheDocument();

    const review = phase('Review').getByRole('link', { name: 'gone-skill, skill not found' });
    expect(review).toHaveAttribute('href', `/factories/${FACTORY_ID}/work/config/pr-review`);
    await user.hover(review);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This factory has no gone-skill skill, so cards entering Review fail to start.',
    );
  });

  it('lists every other phase as next when a phase leaves its moves unset', async () => {
    const phases = storedWorkBoard().board.phases.map(candidate =>
      candidate.key === 'triage' ? { ...candidate, nextPhases: undefined } : candidate,
    );
    stubFactory();
    serveBoard(storedWorkBoard({ phases }));
    serveRules({ rules: [] });
    renderAt(OVERVIEW);

    const triage = within(await screen.findByRole('listitem', { name: 'Triage' }));
    for (const other of phases.filter(candidate => candidate.key !== 'triage')) {
      expect(triage.getAllByText(other.name).length).toBeGreaterThan(0);
    }
    expect(triage.queryByText('Stays here')).not.toBeInTheDocument();
  });

  it('switches a phase to start on its own, saved with the rest of the board', async () => {
    const user = userEvent.setup();
    const saved: { phases: { key: string; autoStart?: boolean }[] }[] = [];
    stubFactory();
    serveBoard(storedWorkBoard());
    serveRules({ rules: [] });
    server.use(
      http.patch('*/web/factory/projects/:id/boards/work', async ({ request }) => {
        saved.push((await request.json()) as (typeof saved)[number]);
        return HttpResponse.json(storedWorkBoard());
      }),
    );
    renderAt(OVERVIEW);

    const planning = within(await screen.findByRole('listitem', { name: 'Planning' }));
    await user.click(planning.getByRole('switch', { name: 'Planning: start on its own' }));
    expect(planning.getByText('Starts on its own')).toBeInTheDocument();
    expect(saved).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].phases.find(candidate => candidate.key === 'planning')?.autoStart).toBe(true);
  });

  it('shows how a phase starts without a switch to someone who cannot edit the board', async () => {
    stubFactory();
    serveBoard(storedWorkBoard({}, false));
    serveRules({ rules: [] });
    renderAt(OVERVIEW);

    const planning = within(await screen.findByRole('listitem', { name: 'Planning' }));
    expect(planning.getByText('Started by hand')).toBeInTheDocument();
    expect(planning.queryByRole('switch')).not.toBeInTheDocument();
  });

  it("doesn't claim a phase has no rule when the rules didn't load", async () => {
    stubFactory();
    serveBoard(storedWorkBoard());
    serveRules({ rules: [] });
    server.use(http.get('*/web/factory/projects/:id/intake-routes', () => HttpResponse.json({}, { status: 500 })));
    renderAt(OVERVIEW);

    expect(await screen.findByText('Rules didn’t load, so the map doesn’t count them.')).toBeInTheDocument();
    expect(phase('Done').getByText('Rules didn’t load')).toBeInTheDocument();
    expect(screen.queryByText('No rule moves cards here')).not.toBeInTheDocument();
  });
});
