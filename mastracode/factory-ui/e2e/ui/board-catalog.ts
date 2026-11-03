import type { BoardCatalogResponse, InstalledBoardInfo } from '../../src/api/types';

export const releaseBoard: InstalledBoardInfo = {
  id: 'release',
  title: 'Release Preview',
  initialPhase: 'queued',
  phases: [
    { id: 'queued', title: 'Queued', kind: 'resting', transitions: [{ outcome: null, to: 'preparing' }] },
    {
      id: 'preparing',
      title: 'Preparing',
      kind: 'working',
      role: 'release-preparer',
      transitions: [{ outcome: null, to: 'shipping' }],
    },
    {
      id: 'shipping',
      title: 'Shipping',
      kind: 'working',
      role: 'release-publisher',
      transitions: [{ outcome: null, to: 'shipped' }],
    },
    { id: 'shipped', title: 'Shipped', kind: 'terminal', transitions: [] },
  ],
};

export const builtinBoardCatalog: BoardCatalogResponse = {
  boards: [
    {
      id: 'work',
      title: 'Work',
      initialPhase: 'intake',
      phases: [
        { id: 'intake', title: 'Intake', kind: 'resting', transitions: [] },
        { id: 'triage', title: 'Triage', kind: 'working', role: 'triage', transitions: [] },
        { id: 'planning', title: 'Planning', kind: 'working', role: 'plan', transitions: [] },
        { id: 'execute', title: 'Building', kind: 'working', role: 'build', transitions: [] },
        { id: 'review', title: 'Review', kind: 'resting', transitions: [] },
        { id: 'pr-review', title: 'PR review', kind: 'working', role: 'review', transitions: [] },
        { id: 'done', title: 'Done', kind: 'terminal', transitions: [] },
        { id: 'canceled', title: 'Canceled', kind: 'terminal', transitions: [] },
      ],
    },
  ],
};

function workingPhase(
  id: string,
  name: string,
  context: string,
  nextPhases: string[],
  extra: Partial<InstalledBoardInfo['phases'][number]> = {},
): InstalledBoardInfo['phases'][number] {
  return {
    id,
    name,
    title: name,
    kind: 'working',
    context,
    role: context,
    autoStart: false,
    nextPhases,
    transitions: [],
    ...extra,
  };
}

/** The built-in Work board as the catalog serves it today: one `work` context from Planning to PR review. */
export const workBoard: InstalledBoardInfo = {
  id: 'work',
  name: 'Work',
  title: 'Work',
  initialPhase: 'intake',
  phases: [
    {
      id: 'intake',
      name: 'Intake',
      title: 'Intake',
      kind: 'resting',
      nextPhases: ['triage', 'planning', 'pr-review', 'done', 'canceled'],
      transitions: [],
    },
    workingPhase('triage', 'Triage', 'triage', ['intake', 'planning', 'done', 'canceled']),
    workingPhase('planning', 'Planning', 'work', ['execute', 'triage', 'intake', 'done', 'canceled'], {
      exitTool: { id: 'submit_plan', autoApprove: false },
    }),
    workingPhase('execute', 'Building', 'work', ['review', 'planning', 'done', 'canceled']),
    workingPhase('review', 'Review', 'work', ['execute', 'intake', 'done', 'canceled']),
    workingPhase('pr-review', 'PR review', 'work', ['intake', 'done', 'canceled']),
    { id: 'done', name: 'Done', title: 'Done', kind: 'terminal', nextPhases: ['pr-review'], transitions: [] },
    {
      id: 'canceled',
      name: 'Canceled',
      title: 'Canceled',
      kind: 'terminal',
      nextPhases: ['intake', 'pr-review'],
      transitions: [],
    },
  ],
};

export const workBoardCatalog: BoardCatalogResponse = {
  boards: [workBoard, builtinBoardCatalog.boards[1]],
};
