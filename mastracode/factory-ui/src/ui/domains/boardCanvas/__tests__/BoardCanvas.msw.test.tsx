import { FACTORY_ROUTE_CONTRACTS } from '@mastra/factory/routes/contracts';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { releaseBoard as releaseBoardInfo, workBoardInfo } from '../../../../../e2e/ui/board-catalog';
import { server } from '../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, waitForMutationsIdle } from '../../../../../e2e/ui/render';
import type { BoardCatalogResponse, FactorySkillInfo, FactorySkillsResponse } from '../../../../api/types';
import {
  flow,
  openPhase,
  phaseNode,
  phaseRow,
  releaseBoard,
  RELEASE_URL,
  serveSaves,
} from '../../boardConfig/__tests__/fixtures/canvas';
import {
  BUILT_IN_SKILLS,
  FACTORY_ID,
  PROJECT_URL,
  renderAt,
  serveBoard,
  stubFactory,
} from '../../boardConfig/__tests__/fixtures/factory-app';
import { storedWorkBoard } from '../../boardConfig/__tests__/fixtures/work-board';
import { rule, serveRules } from '../../boardRules/__tests__/fixtures/rulesServer';

const CONFIG = `/factories/${FACTORY_ID}/work/config`;

function serveCatalog() {
  server.use(
    http.get(`${PROJECT_URL}/boards`, () =>
      HttpResponse.json({ boards: [workBoardInfo, releaseBoardInfo] } satisfies BoardCatalogResponse),
    ),
  );
}

/** The views of one board: its cards, its settings and its routing. */
const boardViews = () => within(screen.getByRole('navigation', { name: 'Board views' }));

describe('Opening board settings', () => {
  it('opens from the board toolbar and the sidebar row, and goes back to the cards', async () => {
    stubFactory();
    serveCatalog();
    serveBoard(storedWorkBoard());
    const user = userEvent.setup();
    const { router } = renderAt(`/factories/${FACTORY_ID}/work`);

    await user.click(await screen.findByRole('link', { name: 'Configure board' }));
    expect(router.state.location.pathname).toBe(CONFIG);
    expect(await screen.findByRole('textbox', { name: 'Board name' })).toHaveValue('Work');
    expect(flow().getByRole('link', { name: 'Planning' })).toHaveAttribute('href', `${CONFIG}/planning`);
    expect(boardViews().getByRole('link', { name: 'Board settings' })).toHaveAttribute('aria-current', 'page');

    await user.click(boardViews().getByRole('link', { name: 'Cards' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/work`));

    serveBoard(releaseBoard({ source: 'app', editable: false, revision: null, codeBehaviour: {} }), RELEASE_URL);
    await user.click(await screen.findByRole('link', { name: 'Configure Release Preview' }));
    expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/boards/release/config`);
    expect(await screen.findByText('This board is defined in code, so it can’t be changed here.')).toBeInTheDocument();
    expect(boardViews().getByRole('link', { name: 'Cards' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/boards/release`,
    );
  });

  it('opens routing for the board in view from the Boards header, and its settings from there', async () => {
    stubFactory();
    serveCatalog();
    serveBoard(releaseBoard(), RELEASE_URL);
    const { router } = renderAt(`/factories/${FACTORY_ID}/boards/release`);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('link', { name: 'Board settings' }));
    expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/boards/release/intake`);

    const views = within(await screen.findByRole('navigation', { name: 'Board views' }));
    await user.click(views.getByRole('link', { name: 'Board settings' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/boards/release/config`));
    expect(await screen.findByRole('textbox', { name: 'Board name' })).toHaveValue('Release Preview');
  });

  it('sends old Work board settings links to the board settings', async () => {
    stubFactory();
    serveBoard(storedWorkBoard());
    const { router } = renderAt(`/factories/${FACTORY_ID}/settings/board`);

    expect(await screen.findByRole('textbox', { name: 'Board name' })).toHaveValue('Work');
    expect(router.state.location.pathname).toBe(CONFIG);
  });

  it.each([
    ['work/moves', 'work/config'],
    ['boards/release/moves', 'boards/release/config'],
    ['work/rules', 'work/config'],
    ['boards/release/rules', 'boards/release/config'],
    ['work/rules?into=planning', 'work/config/planning'],
  ])('sends old Rules and Card moves links at %s to the board settings', async (from, to) => {
    stubFactory();
    serveBoard(storedWorkBoard());
    serveBoard(releaseBoard(), RELEASE_URL);
    const { router } = renderAt(`/factories/${FACTORY_ID}/${from}`);

    await waitFor(() => expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/${to}`));
    expect(await screen.findByRole('list', { name: 'Phases' })).toBeInTheDocument();
  });

  it('sends old Settings › Skills links to the skills, which lead back to the Work board settings', async () => {
    stubFactory();
    serveBoard(storedWorkBoard());
    const { router } = renderAt(`/factories/${FACTORY_ID}/settings/skills`);

    expect(await screen.findByRole('heading', { name: 'Skills' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/work/skills`);
    const breadcrumb = within(await screen.findByRole('navigation', { name: 'Breadcrumb' }));
    expect(breadcrumb.getByRole('link', { name: 'Work' })).toHaveAttribute('href', CONFIG);
  });

  it('lists the factory skills beside a custom board, leading back to its settings', async () => {
    stubFactory();
    serveBoard(releaseBoard(), RELEASE_URL);
    renderAt(`/factories/${FACTORY_ID}/boards/release/skills`);

    expect(await screen.findByRole('heading', { name: 'Skills' })).toBeInTheDocument();
    const breadcrumb = within(await screen.findByRole('navigation', { name: 'Breadcrumb' }));
    expect(await breadcrumb.findByRole('link', { name: 'Release Preview' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/boards/release/config`,
    );
  });
});

describe('Leaving board settings with unsaved changes', () => {
  it('asks before leaving for the cards, and stays with the edit on Keep editing', async () => {
    stubFactory();
    serveBoard(storedWorkBoard());
    const { router } = renderAt(`${CONFIG}/planning`);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Instructions, goal, session, tools' }));
    await user.type(await screen.findByRole('textbox', { name: 'Planning instructions' }), 'Keep plans short.');
    await user.click(boardViews().getByRole('link', { name: 'Cards' }));

    const dialog = await screen.findByRole('alertdialog', { name: 'Discard changes to Work?' });
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe(`${CONFIG}/planning`);
    expect(screen.getByRole('textbox', { name: 'Planning instructions' })).toHaveTextContent('Keep plans short.');

    await user.click(boardViews().getByRole('link', { name: 'Cards' }));
    await user.click(
      within(await screen.findByRole('alertdialog', { name: 'Discard changes to Work?' })).getByRole('button', {
        name: 'Discard',
      }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/work`));
  });

  it('asks before leaving for Routing, which has no save bar', async () => {
    stubFactory();
    serveBoard(storedWorkBoard());
    const user = userEvent.setup();
    const { router } = renderAt(CONFIG);

    await user.type(await screen.findByRole('textbox', { name: 'Board name' }), ' board');
    await user.click(boardViews().getByRole('link', { name: 'Routing' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard changes to Work?' });
    await user.click(within(dialog).getByRole('button', { name: 'Discard' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/work/intake`));
  });

  it("asks before opening a phase's skill, which saves on its own page", async () => {
    stubFactory();
    serveBoard(storedWorkBoard());
    const user = userEvent.setup();
    const { router } = renderAt(CONFIG);

    await user.type(await screen.findByRole('textbox', { name: 'Board name' }), ' board');
    const planning = await openPhase('Planning', user);
    await user.click(await planning.findByRole('link', { name: 'Edit factory-plan' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard changes to Work?' });
    await user.click(within(dialog).getByRole('button', { name: 'Discard' }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/work/skills/factory-plan`),
    );
  });
});

describe("A phase's skill", () => {
  it('opens on its own page, and browser back returns to the phase showing the edit saved there', async () => {
    stubFactory();
    serveBoard(storedWorkBoard());
    let plan: FactorySkillInfo = {
      name: 'factory-plan',
      description: 'Plans the work',
      content: 'Write a plan.',
      builtIn: true,
    };
    const writes: string[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/skills`, () =>
        HttpResponse.json({ skills: [plan], canEdit: true } satisfies FactorySkillsResponse),
      ),
      http.put(`${PROJECT_URL}/skills/:name`, async ({ request }) => {
        const { content } = FACTORY_ROUTE_CONTRACTS.skillOverrideSave.bodySchema.parse(await request.json());
        writes.push(content);
        plan = {
          ...plan,
          description: 'Plans small work',
          edited: { updatedBy: 'user-1', updatedAt: '2026-11-09T00:00:00.000Z' },
        };
        return HttpResponse.json({ skill: plan });
      }),
    );
    const user = userEvent.setup();
    const { router, client } = renderAt(CONFIG);

    const planning = await openPhase('Planning', user);
    expect(await planning.findByText('Plans the work')).toBeInTheDocument();
    const phasePath = router.state.location.pathname;
    await user.click(planning.getByRole('link', { name: 'Edit factory-plan' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/work/skills/factory-plan`),
    );
    const description = await screen.findByRole('textbox', { name: 'Description' });
    await user.clear(description);
    await user.type(description, 'Plans small work');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument());
    expect(writes).toHaveLength(1);
    expect(writes[0]).toContain('description: "Plans small work"');
    expect(screen.getByRole('link', { name: 'Back to Skills' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/work/skills`,
    );

    await router.navigate(-1);
    await waitFor(() => expect(router.state.location.pathname).toBe(phasePath));
    const back = within(await screen.findByRole('complementary', { name: 'Planning' }));
    expect(await back.findByText('Plans small work')).toBeInTheDocument();
    expect(back.getByText('Edited')).toBeInTheDocument();
    await waitForMutationsIdle(client);
  });
});

describe('Who may change a board', () => {
  it('shows the board read-only to someone who is not an organization admin', async () => {
    stubFactory();
    serveBoard(storedWorkBoard({}, false));
    const user = userEvent.setup();
    renderAt(CONFIG);

    expect(await screen.findByText('Only organization admins can change this board.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Board name' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Add a phase after/ })).not.toBeInTheDocument();
    expect(phaseNode('Planning').queryByRole('button', { name: 'Change moves from Planning' })).not.toBeInTheDocument();

    const planning = await openPhase('Planning', user);
    expect(planning.queryByRole('textbox', { name: 'Phase name' })).not.toBeInTheDocument();
    expect(planning.getByRole('switch', { name: 'Planning: start on its own' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('saves a stored board to its own address', async () => {
    stubFactory();
    serveBoard(releaseBoard(), RELEASE_URL);
    const saved = serveSaves(RELEASE_URL, body => releaseBoard({ ...body, revision: 4 }));
    const user = userEvent.setup();
    const { client } = renderAt(`/factories/${FACTORY_ID}/boards/release/config`);

    expect(await screen.findByRole('textbox', { name: 'Board name' })).toHaveValue('Release Preview');
    expect(flow().getByRole('link', { name: 'Drafting' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/boards/release/config/drafting`,
    );

    const drafting = await openPhase('Drafting', user);
    await user.click(drafting.getByRole('button', { name: 'Instructions, goal, session, tools' }));
    await user.type(await screen.findByRole('textbox', { name: 'Drafting instructions' }), 'Keep it short.');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitForMutationsIdle(client);

    expect(saved).toHaveBeenCalledOnce();
    const body = saved.mock.calls[0][0];
    expect(body.expectedRevision).toBe(3);
    expect(body.phases.find(phase => phase.key === 'drafting')?.runner).toEqual({
      skill: 'release-notes',
      context: 'release',
      instructions: 'Keep it short.',
    });
  });

  it('shows a board defined in app code without letting anyone change it', async () => {
    stubFactory();
    serveBoard(releaseBoard({ source: 'app', editable: false, revision: null, codeBehaviour: {} }), RELEASE_URL);
    const user = userEvent.setup();
    renderAt(`/factories/${FACTORY_ID}/boards/release/config`);

    expect(await screen.findByText('This board is defined in code, so it can’t be changed here.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Board actions' })).not.toBeInTheDocument();

    const drafting = await openPhase('Drafting', user);
    expect(drafting.queryByRole('textbox', { name: 'Phase name' })).not.toBeInTheDocument();
    await user.click(drafting.getByRole('button', { name: 'Instructions, goal, session, tools' }));
    expect(await screen.findByRole('textbox', { name: 'Drafting instructions' })).toHaveAttribute(
      'aria-readonly',
      'true',
    );
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });
});

const PARKED = { key: 'parked', name: 'Parked', kind: 'resting' as const, nextPhases: ['intake'] };

/** Work with a phase at the end that no move leads into. */
const workWithParked = () => storedWorkBoard({ phases: [...storedWorkBoard().board.phases, PARKED] });

const bugs = rule({
  name: 'Labelled bugs go to Triage',
  when: { operator: 'AND', conditions: [{ field: 'item.labels', operator: 'contains', value: 'bug' }] },
  target: { boardKey: 'work', phaseKey: 'triage', joinClosedIssue: false, moveToBoardKey: null },
});
const everything = rule({ name: 'Everything else' });
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
const parking = rule({
  name: 'Stale cards are parked',
  on: ['work_item.updated'],
  when: { operator: 'AND', conditions: [{ field: 'item.labels', operator: 'contains', value: 'stale' }] },
  target: { boardKey: 'work', phaseKey: 'parked', joinClosedIssue: false, moveToBoardKey: null },
});

describe('The board canvas', () => {
  it("shows each rule on the row of the phase it files into, and other boards' rules where they meet this board", async () => {
    stubFactory();
    serveBoard(workWithParked());
    serveRules({ rules: [bugs, everything, toRelease, fromRelease] });
    renderAt(CONFIG);

    const triage = await screen.findByRole('link', { name: /^Labelled bugs go to Triage, rule 1 of 2 on / });
    expect(phaseRow('Triage').getByRole('link', { name: triage.getAttribute('aria-label') ?? '' })).toBe(triage);
    expect(triage).toHaveAttribute('href', `${CONFIG}?rule=${bugs.id}`);
    // A rule without a phase files into the first one.
    expect(phaseRow('Intake').getByRole('link', { name: /^Everything else, rule 2 of 2 on / })).toHaveTextContent(
      'Every new issue',
    );

    // Release Preview's rule moves its merged cards into Work's Done; it opens on Release Preview's settings.
    expect(phaseRow('Done').getByRole('link', { name: 'Release Preview' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/boards/release/config?rule=${fromRelease.id}`,
    );

    const leaving = within(screen.getByRole('region', { name: 'To other boards' }));
    expect(
      leaving.getByRole('link', { name: /^Labelled releases go to Release Preview, rule 1 of 1 on / }),
    ).toBeInTheDocument();
    expect(leaving.getByRole('link', { name: /Queued.*Release Preview/ })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/boards/release/config/queued`,
    );

    // Nothing moves cards into Parked; every other phase is reached by a rule or a move.
    expect(phaseNode('Parked').getByText('No rule or move leads here')).toBeInTheDocument();
    expect(screen.getAllByText('No rule or move leads here')).toHaveLength(1);
  });

  it('counts a phase a rule files into as reached', async () => {
    stubFactory();
    serveBoard(workWithParked());
    serveRules({ rules: [everything, parking] });
    renderAt(CONFIG);

    expect(await screen.findByRole('link', { name: /^Stale cards are parked, / })).toBeInTheDocument();
    expect(phaseRow('Parked').getByRole('link', { name: /^Stale cards are parked, / })).toBeInTheDocument();
    expect(screen.queryByText('No rule or move leads here')).not.toBeInTheDocument();
  });

  it("says the rules didn't load, and doesn't claim no rule leads to a phase", async () => {
    stubFactory();
    serveBoard(workWithParked());
    serveRules({ rules: [everything, parking] });
    server.use(http.get(`${PROJECT_URL}/intake-routes`, () => HttpResponse.json({}, { status: 500 })));
    renderAt(CONFIG);

    expect(await screen.findByRole('article', { name: 'Parked' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Board name' })).toBeInTheDocument());
    expect(await screen.findByText('Rules didn’t load, so the map doesn’t show them.')).toBeInTheDocument();
    expect(screen.queryByText('No rule or move leads here')).not.toBeInTheDocument();
  });

  it("marks another board's switched-off rule as off, and lists one into a phase this board lost", async () => {
    const offFromRelease = rule({
      name: 'Paused releases land in Done',
      enabled: false,
      on: ['pull_request.merged'],
      target: { boardKey: 'release', phaseKey: 'done', joinClosedIssue: false, moveToBoardKey: 'work' },
    });
    const intoGone = rule({
      name: 'Releases go back to review',
      on: ['pull_request.closed'],
      target: { boardKey: 'release', phaseKey: 'review', joinClosedIssue: false, moveToBoardKey: 'work' },
    });
    stubFactory();
    serveBoard(storedWorkBoard());
    serveRules({ rules: [everything, offFromRelease, intoGone] });
    renderAt(CONFIG);

    const off = await screen.findByRole('link', { name: 'Release Preview, off' });
    expect(phaseRow('Done').getByRole('link', { name: 'Release Preview, off' })).toBe(off);
    expect(off).toHaveAttribute('href', `/factories/${FACTORY_ID}/boards/release/config?rule=${offFromRelease.id}`);
    const removed = within(screen.getByRole('region', { name: 'Into a removed phase' }));
    expect(removed.getByRole('link', { name: 'Release Preview' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/boards/release/config?rule=${intoGone.id}`,
    );
  });

  it('opens a new rule into a phase from its row, and a rule from its chip, in the side panel', async () => {
    stubFactory();
    serveBoard(storedWorkBoard());
    serveRules({ rules: [bugs, everything] });
    const user = userEvent.setup();
    const { router } = renderAt(CONFIG);

    await user.click(await screen.findByRole('link', { name: 'Add a rule into Planning' }));
    await waitFor(() => expect(router.state.location.search).toBe('?rule=new&into=planning'));
    expect(router.state.location.pathname).toBe(CONFIG);

    await user.click(screen.getByRole('link', { name: /^Labelled bugs go to Triage, rule 1 of 2 on / }));
    await waitFor(() => expect(router.state.location.search).toBe(`?rule=${bugs.id}`));
    expect(await screen.findByRole('complementary', { name: bugs.name })).toBeInTheDocument();
  });

  it('offers no new rule to someone who may not change rules', async () => {
    stubFactory();
    serveBoard(storedWorkBoard());
    serveRules({ rules: [bugs, everything], canEdit: false });
    renderAt(CONFIG);

    expect(await screen.findByRole('link', { name: /^Labelled bugs go to Triage, / })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Add a rule into Planning' })).not.toBeInTheDocument();
  });

  it('tests where an issue would go from the toolbar, in the side panel', async () => {
    stubFactory();
    serveBoard(storedWorkBoard());
    server.use(
      http.post(`${PROJECT_URL}/intake/test`, () =>
        HttpResponse.json({ error: 'not_found', message: 'No such issue.' }, { status: 404 }),
      ),
    );
    const url = 'https://github.com/acme/app/issues/12';
    const user = userEvent.setup();
    const { router } = renderAt(CONFIG);

    const toolbar = within(await screen.findByRole('toolbar', { name: 'Canvas' }));
    await user.type(toolbar.getByRole('textbox', { name: 'Test an issue or pull request' }), `${url}{Enter}`);

    await waitFor(() => expect(new URLSearchParams(router.state.location.search).get('test')).toBe(url));
    expect(await screen.findByRole('complementary', { name: 'Where would this go?' })).toBeInTheDocument();
  });

  it('shows who works each phase, how it ends, where its cards start and where they go next', async () => {
    const small = {
      operator: 'AND' as const,
      conditions: [{ field: 'item.labels', operator: 'contains' as const, value: 'small' }],
    };
    const phases = storedWorkBoard().board.phases.map(phase =>
      phase.key === 'planning'
        ? { ...phase, exitTool: { id: 'submit_plan', autoApprove: true, autoApproveWhen: small } }
        : phase.key === 'triage'
          ? { ...phase, autoStart: true, nextPhases: undefined }
          : phase,
    );
    stubFactory();
    serveBoard(storedWorkBoard({ phases }));
    renderAt(CONFIG);

    const planning = within(await screen.findByRole('article', { name: 'Planning' }));
    expect(phaseNode('Intake').getByText('New cards start here')).toBeInTheDocument();
    expect(screen.getAllByText('New cards start here')).toHaveLength(1);
    expect(planning.getByText('factory-plan')).toBeInTheDocument();
    expect(planning.getByText('By hand')).toBeInTheDocument();
    expect(planning.getByText('submit_plan')).toBeInTheDocument();
    expect(planning.getByText('Approved on its own only if labels contains small')).toBeInTheDocument();
    expect(planning.getByText('Building')).toBeInTheDocument();
    expect(phaseNode('Triage').getByText('On its own')).toBeInTheDocument();
    // Unset moves allow every other phase.
    for (const other of phases.filter(phase => phase.key !== 'triage')) {
      expect(phaseNode('Triage').getAllByText(other.name).length).toBeGreaterThan(0);
    }
    expect(phaseNode('Done').queryByText('By hand')).not.toBeInTheDocument();
  });

  it("flags a phase whose skill the project doesn't have or can't load", async () => {
    const phases = storedWorkBoard().board.phases.map(phase =>
      phase.key === 'triage' ? { ...phase, runner: { ...phase.runner, skill: 'factory-triage' } } : phase,
    );
    stubFactory();
    serveBoard(storedWorkBoard({ phases }));
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/skills`, () =>
        HttpResponse.json({
          skills: [
            ...BUILT_IN_SKILLS.filter(skill => skill.name !== 'factory-plan' && skill.name !== 'factory-triage'),
            { name: 'factory-triage', description: '', content: '', builtIn: true, error: 'Bad frontmatter' },
          ],
          canEdit: true,
        } satisfies FactorySkillsResponse),
      ),
    );
    renderAt(CONFIG);

    const planning = within(await screen.findByRole('article', { name: 'Planning' }));
    expect(await planning.findByText('Skill not found')).toBeInTheDocument();
    expect(phaseNode('Triage').getByText('Skill failed to load')).toBeInTheDocument();
    expect(phaseNode('Building').queryByText(/^Skill /)).not.toBeInTheDocument();
  });
});
