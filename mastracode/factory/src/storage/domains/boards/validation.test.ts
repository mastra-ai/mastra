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

  it('rejects two boards with one key', () => {
    const result = projectBoardConfigInputSchema.safeParse({
      boards: [board([open, closed]), board([open, closed])],
      intakeRoutes: [],
    });
    expect(messages(result)).toContain("Board 'b' is repeated.");
  });
});
