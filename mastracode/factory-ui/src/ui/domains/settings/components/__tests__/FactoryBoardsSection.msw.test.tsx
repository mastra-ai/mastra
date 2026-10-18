import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { builtinBoardCatalog } from '../../../../../../e2e/ui/board-catalog';
import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import type { BoardInput } from '../../../../../hooks/usePhaseSkills';
import type {
  InstalledBoardInfo,
  LibrarySkillInfo,
  PhaseSkillInfo,
  PhaseSkillsResponse,
  SkillLibraryResponse,
} from '../../../../../api/types';
import { FactoryBoardsSection } from '../FactoryBoardsSection';

const BOARDS_URL = `${TEST_BASE_URL}/web/factory/projects/fp-1/boards`;
const PHASE_SKILLS_URL = `${TEST_BASE_URL}/web/factory/projects/fp-1/phase-skills`;
const LIBRARY_URL = `${TEST_BASE_URL}/web/factory/projects/fp-1/skill-library`;
const STAMP = new Date(0).toISOString();

function mockServer(initialSkills: LibrarySkillInfo[] = []) {
  let overrides: PhaseSkillInfo[] = [];
  let skills = initialSkills;
  let boards: InstalledBoardInfo[] = [...builtinBoardCatalog.boards];
  const toCatalog = (id: string, body: BoardInput): InstalledBoardInfo => ({
    id,
    title: body.title,
    custom: true,
    initialPhase: body.initialPhase,
    phases: body.phases.map(({ next, ...phase }) => ({
      ...phase,
      transitions: next.map(to => ({ outcome: to, to })),
    })),
  });
  const writes: Array<{ method: string; path: string; body?: unknown }> = [];
  server.use(
    http.get(BOARDS_URL, () => HttpResponse.json({ boards })),
    http.post(BOARDS_URL, async ({ request }) => {
      const body = (await request.json()) as BoardInput;
      writes.push({ method: 'POST', path: 'boards', body });
      boards = [...boards, toCatalog('custom-1', body)];
      return HttpResponse.json({ board: { id: 'custom-1' } }, { status: 201 });
    }),
    http.put(`${BOARDS_URL}/:boardId`, async ({ request, params }) => {
      const body = (await request.json()) as BoardInput;
      writes.push({ method: 'PUT', path: `boards/${params.boardId}`, body });
      boards = boards.map(b => (b.id === params.boardId ? toCatalog(b.id, body) : b));
      return HttpResponse.json({ board: { id: params.boardId } });
    }),
    http.delete(`${BOARDS_URL}/:boardId`, ({ params }) => {
      writes.push({ method: 'DELETE', path: `boards/${params.boardId}` });
      boards = boards.filter(b => b.id !== params.boardId);
      return new HttpResponse(null, { status: 204 });
    }),
    http.get(LIBRARY_URL, () => HttpResponse.json({ skills } satisfies SkillLibraryResponse)),
    http.post(LIBRARY_URL, async ({ request }) => {
      const body = (await request.json()) as { name: string; description: string; content: string };
      writes.push({ method: 'POST', path: 'skill-library', body });
      const skill = { ...body, createdAt: STAMP, updatedAt: STAMP };
      skills = [...skills, skill];
      return HttpResponse.json({ skill }, { status: 201 });
    }),
    http.delete(`${LIBRARY_URL}/:name`, ({ params }) => {
      writes.push({ method: 'DELETE', path: `skill-library/${params.name}` });
      skills = skills.filter(s => s.name !== params.name);
      overrides = overrides.filter(o => o.skillName !== params.name);
      return new HttpResponse(null, { status: 204 });
    }),
    http.get(PHASE_SKILLS_URL, () => HttpResponse.json({ phaseSkills: overrides } satisfies PhaseSkillsResponse)),
    http.put(`${PHASE_SKILLS_URL}/:boardId/:phaseId`, async ({ request, params }) => {
      const body = (await request.json()) as { skillName?: string; prompt?: string };
      writes.push({ method: 'PUT', path: `${params.boardId}/${params.phaseId}`, body });
      const kickoff = body.skillName
        ? { skillName: body.skillName, prompt: null }
        : { skillName: null, prompt: body.prompt! };
      const record = { boardId: String(params.boardId), phaseId: String(params.phaseId), ...kickoff, updatedAt: STAMP };
      overrides = [...overrides.filter(o => o.boardId !== record.boardId || o.phaseId !== record.phaseId), record];
      return HttpResponse.json({ phaseSkill: record });
    }),
    http.delete(`${PHASE_SKILLS_URL}/:boardId/:phaseId`, ({ params }) => {
      writes.push({ method: 'DELETE', path: `${params.boardId}/${params.phaseId}` });
      overrides = overrides.filter(o => o.boardId !== params.boardId || o.phaseId !== params.phaseId);
      return HttpResponse.json({ ok: true });
    }),
  );
  return writes;
}

const firstWorkingPhase = () => {
  const board = builtinBoardCatalog.boards.find(b => b.phases.some(p => p.kind === 'working'))!;
  return { board, phase: board.phases.find(p => p.kind === 'working')! };
};

const mySkill: LibrarySkillInfo = {
  name: 'my-build',
  description: 'Builds the card',
  content: 'Build it.',
  createdAt: STAMP,
  updatedAt: STAMP,
};

describe('FactoryBoardsSection', () => {
  it('lists each board with its working phases on the board default, without built-in skills', async () => {
    mockServer();
    renderWithProviders(<FactoryBoardsSection factoryId="fp-1" />);

    const { board, phase } = firstWorkingPhase();
    expect(await screen.findByRole('region', { name: `${board.title} board` })).toBeInTheDocument();
    const trigger = screen.getByRole('combobox', { name: `Kickoff for ${board.title} ${phase.title}` });
    expect(trigger).toHaveTextContent('Board default');

    await userEvent.setup().click(trigger);
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(['Board default', 'Custom prompt…']);
  });

  it('creates a library skill, runs it in a phase, and deleting it resets the phase', async () => {
    const writes = mockServer();
    const user = userEvent.setup();
    renderWithProviders(<FactoryBoardsSection factoryId="fp-1" />);

    await user.click(await screen.findByRole('button', { name: /New skill/ }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox', { name: 'Skill name' }), mySkill.name);
    await user.type(within(dialog).getByRole('textbox', { name: 'Skill description' }), mySkill.description);
    await user.type(within(dialog).getByRole('textbox', { name: 'Skill instructions' }), mySkill.content);
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(writes[0]).toEqual({
      method: 'POST',
      path: 'skill-library',
      body: { name: mySkill.name, description: mySkill.description, content: mySkill.content },
    });

    const { board, phase } = firstWorkingPhase();
    const trigger = screen.getByRole('combobox', { name: `Kickoff for ${board.title} ${phase.title}` });
    await user.click(trigger);
    await user.click(await screen.findByRole('option', { name: 'my-build' }));
    await waitFor(() => expect(trigger).toHaveTextContent('my-build'));
    expect(writes.at(-1)).toEqual({ method: 'PUT', path: `${board.id}/${phase.id}`, body: { skillName: 'my-build' } });

    await user.click(screen.getByRole('button', { name: 'Delete my-build' }));
    await waitFor(() => expect(trigger).toHaveTextContent('Board default'));
    expect(writes.at(-1)).toEqual({ method: 'DELETE', path: 'skill-library/my-build' });
    await waitFor(() => expect(trigger).toHaveTextContent('Board default'));
  });

  it('sets a custom prompt on a phase and resets it', async () => {
    const writes = mockServer([mySkill]);
    const user = userEvent.setup();
    renderWithProviders(<FactoryBoardsSection factoryId="fp-1" />);

    const { board, phase } = firstWorkingPhase();
    const label = `${board.title} ${phase.title}`;
    const trigger = await screen.findByRole('combobox', { name: `Kickoff for ${label}` });
    await user.click(trigger);
    await user.click(await screen.findByRole('option', { name: 'Custom prompt…' }));
    await user.type(await screen.findByRole('textbox', { name: `Prompt for ${label}` }), 'Ship it carefully.');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(trigger).toHaveTextContent('Custom prompt'));
    expect(writes.at(-1)).toEqual({
      method: 'PUT',
      path: `${board.id}/${phase.id}`,
      body: { prompt: 'Ship it carefully.' },
    });

    await user.click(screen.getByRole('button', { name: `Reset ${label} to board default` }));
    await waitFor(() => expect(trigger).toHaveTextContent('Board default'));
    expect(writes.at(-1)).toEqual({ method: 'DELETE', path: `${board.id}/${phase.id}` });
  });

  it('creates a board from the starter phases, edits it, and deletes it', async () => {
    const writes = mockServer();
    const user = userEvent.setup();
    renderWithProviders(<FactoryBoardsSection factoryId="fp-1" />);

    await user.click(await screen.findByRole('button', { name: /New board/ }));
    let dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox', { name: 'Board title' }), 'Ops');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(writes.at(-1)).toEqual({
      method: 'POST',
      path: 'boards',
      body: {
        title: 'Ops',
        initialPhase: 'backlog',
        phases: [
          { id: 'backlog', title: 'Backlog', kind: 'resting', next: ['working'] },
          { id: 'working', title: 'Working', kind: 'working', role: 'work', next: ['done'] },
          { id: 'done', title: 'Done', kind: 'terminal', next: [] },
        ],
      },
    });
    expect(await screen.findByRole('combobox', { name: 'Kickoff for Ops Working' })).toHaveTextContent('Board default');

    await user.click(screen.getByRole('button', { name: 'Edit Ops board' }));
    dialog = await screen.findByRole('dialog');
    const title = within(dialog).getByRole('textbox', { name: 'Board title' });
    await user.clear(title);
    await user.type(title, 'Operations');
    await user.click(within(dialog).getByRole('checkbox', { name: 'Working moves to Backlog' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(writes.at(-1)).toMatchObject({
      method: 'PUT',
      path: 'boards/custom-1',
      body: { title: 'Operations', phases: [{}, { id: 'working', next: ['done', 'backlog'] }, {}] },
    });
    expect(await screen.findByRole('region', { name: 'Operations board' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete Operations board' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Operations board' })).not.toBeInTheDocument());
    expect(writes.at(-1)).toEqual({ method: 'DELETE', path: 'boards/custom-1' });
    expect(screen.queryByRole('button', { name: /Edit Work board/ })).not.toBeInTheDocument();
  });
});
