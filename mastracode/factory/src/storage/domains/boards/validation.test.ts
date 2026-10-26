import { describe, expect, it } from 'vitest';

import { defaultProjectBoardConfig, workBoardTemplate } from '../../../boards/templates/work.js';
import { projectBoardConfigInputSchema, storedBoardInputSchema } from './validation.js';

const messages = (result: { success: boolean; error?: { issues: Array<{ message: string }> } }) =>
  result.error?.issues.map(issue => issue.message) ?? [];

describe('stored board validation', () => {
  it('accepts the Work template and the default project config', () => {
    expect(storedBoardInputSchema.safeParse(workBoardTemplate).success).toBe(true);
    expect(projectBoardConfigInputSchema.safeParse(defaultProjectBoardConfig).success).toBe(true);
  });

  it('keeps the phase keys Factory moves Work cards by, and lets their names change', () => {
    const [work] = defaultProjectBoardConfig.boards;
    const renamed = {
      ...defaultProjectBoardConfig,
      boards: [{ ...work, phases: work.phases.map(phase => ({ ...phase, name: `${phase.name}!` })) }],
    };
    expect(projectBoardConfigInputSchema.safeParse(renamed).success).toBe(true);
    const withoutTriage = {
      ...defaultProjectBoardConfig,
      boards: [
        {
          ...work,
          phases: work.phases.filter(phase => phase.key !== 'triage'),
          eventRoutes: [],
        },
      ],
      intakeRoutes: [],
    };
    const result = projectBoardConfigInputSchema.safeParse(withoutTriage);
    expect(result.error?.issues.map(issue => issue.message)).toContain(
      'The Work board needs the phases triage; Factory moves cards by these keys.',
    );
  });

  it("keeps the kinds of Work's phases and leaves their moves to Factory", () => {
    const [work] = defaultProjectBoardConfig.boards;
    const edited = {
      ...defaultProjectBoardConfig,
      boards: [
        {
          ...work,
          phases: work.phases.map(phase =>
            phase.key === 'review'
              ? { ...phase, kind: 'resting' as const, runner: undefined, exitTool: undefined }
              : phase.key === 'triage'
                ? { ...phase, nextPhases: ['intake'] }
                : phase.key === 'intake'
                  ? { ...phase, nextPhases: ['triage', 'done', 'canceled'] }
                  : phase,
          ),
        },
      ],
    };
    const result = projectBoardConfigInputSchema.safeParse(edited);
    expect(result.error?.issues.map(issue => issue.message)).toEqual(
      expect.arrayContaining([
        "Work's review phase must stay working.",
        "Work's triage phase must allow moving to planning, review, done, canceled; Factory moves cards there itself.",
        "Work's intake phase must allow moving to review; Factory moves cards there itself.",
      ]),
    );
  });

  it("rejects the retired Review board's key", () => {
    const result = projectBoardConfigInputSchema.safeParse({
      boards: [{ ...defaultProjectBoardConfig.boards[0], key: 'review', eventRoutes: [] }],
      intakeRoutes: [],
    });
    expect(result.error?.issues.map(issue => issue.message)).toContain(
      "'review' was the Review board's id and now means Work. Pick another key.",
    );
  });

  const board = (phases: unknown[], extra: Record<string, unknown> = {}) => ({ key: 'b', name: 'B', phases, ...extra });
  const open = { key: 'open', name: 'Open', kind: 'resting' };
  const closed = { key: 'closed', name: 'Closed', kind: 'terminal' };

  it('rejects next phases that are not on the board or point back at themselves', () => {
    expect(messages(storedBoardInputSchema.safeParse(board([{ ...open, nextPhases: ['gone'] }, closed])))).toContain(
      "Phase 'gone' is not on this board.",
    );
    expect(messages(storedBoardInputSchema.safeParse(board([{ ...open, nextPhases: ['open'] }, closed])))).toContain(
      'A phase cannot list itself as a next phase.',
    );
  });

  it('rejects a runner on a resting phase', () => {
    const result = storedBoardInputSchema.safeParse(
      board([{ ...open, runner: { type: 'workflow', workflowId: 'factory-triage' } }, closed]),
    );
    expect(messages(result)).toContain('A resting phase runs nothing.');
  });

  it('rejects keys that are not lowercase slugs and names that are blank once trimmed', () => {
    expect(storedBoardInputSchema.safeParse({ ...board([open, closed]), key: 'Work' }).success).toBe(false);
    expect(storedBoardInputSchema.safeParse({ ...board([open, closed]), key: 'my board' }).success).toBe(false);
    expect(storedBoardInputSchema.safeParse({ ...board([open, closed]), name: '   ' }).success).toBe(false);
    expect(storedBoardInputSchema.parse({ ...board([open, closed]), name: '  Trimmed  ' }).name).toBe('Trimmed');
  });

  it('needs a terminal phase, not first, and unique phase keys', () => {
    expect(messages(storedBoardInputSchema.safeParse(board([open])))).toContain(
      'A board needs at least one terminal phase.',
    );
    expect(messages(storedBoardInputSchema.safeParse(board([closed, open])))).toContain(
      'The first phase cannot be terminal.',
    );
    expect(messages(storedBoardInputSchema.safeParse(board([open, open, closed])))).toContain(
      "Phase 'open' is repeated.",
    );
  });

  it('rejects a runner that sets both an agent and a workflow', () => {
    const result = storedBoardInputSchema.safeParse(
      board([
        open,
        { key: 'w', name: 'W', kind: 'working', runner: { type: 'agent', agentId: 'a', workflowId: 'b' } },
        closed,
      ]),
    );
    expect(result.success).toBe(false);
  });

  it('rejects routes that name phases the board does not have', () => {
    const result = projectBoardConfigInputSchema.safeParse({
      boards: [
        board([open, closed], {
          eventRoutes: [{ event: 'pull_request.merged', fromPhases: ['nope'], toPhaseKey: 'gone' }],
        }),
      ],
      intakeRoutes: [{ boardKey: 'b', phaseKey: 'missing' }],
    });
    expect(messages(result)).toEqual([
      "Phase 'gone' is not on board 'b'.",
      "Phase 'nope' is not on board 'b'.",
      "Phase 'missing' is not on board 'b'.",
    ]);
  });

  it('needs an agent runner to carry a skill or instructions, and a resting first phase', () => {
    const doing = (runner: unknown) => ({ key: 'doing', name: 'Doing', kind: 'working', runner });
    expect(
      messages(storedBoardInputSchema.safeParse(board([open, doing({ type: 'agent', agentId: 'factory' }), closed]))),
    ).toContain('An agent runner needs a skill or instructions.');
    expect(
      storedBoardInputSchema.safeParse(
        board([open, doing({ type: 'agent', agentId: 'factory', skill: 'write-docs', seat: 'plan' }), closed]),
      ).success,
    ).toBe(true);
    expect(
      storedBoardInputSchema.safeParse(
        board([open, doing({ type: 'agent', agentId: 'factory', instructions: 'Go.', seat: 'boss' }), closed]),
      ).success,
    ).toBe(false);
    expect(
      messages(
        storedBoardInputSchema.safeParse(board([doing({ type: 'agent', agentId: 'f', instructions: 'Go.' }), closed])),
      ),
    ).toContain('The first phase must be resting.');
  });

  it('rejects two boards with one key', () => {
    const result = projectBoardConfigInputSchema.safeParse({
      boards: [board([open, closed]), board([open, closed])],
      intakeRoutes: [],
    });
    expect(messages(result)).toContain("Board 'b' is repeated.");
  });
});
