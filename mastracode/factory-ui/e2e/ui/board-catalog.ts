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
        { id: 'done', title: 'Done', kind: 'terminal', transitions: [] },
        { id: 'canceled', title: 'Canceled', kind: 'terminal', transitions: [] },
      ],
    },
    {
      id: 'review',
      title: 'Review',
      initialPhase: 'intake',
      phases: [
        { id: 'intake', title: 'Intake', kind: 'resting', transitions: [] },
        { id: 'review', title: 'Reviewing', kind: 'working', role: 'review', transitions: [] },
        { id: 'done', title: 'Done', kind: 'terminal', transitions: [] },
        { id: 'canceled', title: 'Canceled', kind: 'terminal', transitions: [] },
      ],
    },
  ],
};
