import type { InstalledBoardInfo, InstalledPhaseInfo } from '../../../api/types';

export type BoardLayout = 'standard' | 'custom';
export type StoryLane = { stage: string; label: string; custom: boolean };
export type StoryBoardLanes = { id: string; title: string; lanes: StoryLane[] };

export const WORK_LANES: StoryLane[] = [
  { stage: 'triage', label: 'Triage', custom: false },
  { stage: 'planning', label: 'Planning', custom: false },
  { stage: 'execute', label: 'Building', custom: false },
  { stage: 'review', label: 'Review', custom: false },
];

export const SECURITY_REVIEW_STAGE = 'security-review';

const SECURITY_REVIEW_PHASE: InstalledPhaseInfo = {
  id: SECURITY_REVIEW_STAGE,
  title: 'Security review',
  kind: 'working',
  transitions: [],
};

export const INCIDENTS_BOARD: InstalledBoardInfo = {
  id: 'incidents',
  title: 'Incidents',
  initialPhase: 'reported',
  phases: [
    { id: 'reported', title: 'Reported', kind: 'resting', transitions: [] },
    { id: 'investigate', title: 'Investigate', kind: 'working', transitions: [] },
    { id: 'mitigate', title: 'Mitigate', kind: 'working', transitions: [] },
    { id: 'postmortem', title: 'Postmortem', kind: 'working', transitions: [] },
  ],
};

function customLane(phase: InstalledPhaseInfo): StoryLane {
  return { stage: phase.id, label: phase.title, custom: true };
}

function withSecurityReview(board: InstalledBoardInfo): InstalledBoardInfo {
  if (board.id !== 'work') return board;
  const after = board.phases.findIndex(phase => phase.id === 'execute') + 1;
  return { ...board, phases: [...board.phases.slice(0, after), SECURITY_REVIEW_PHASE, ...board.phases.slice(after)] };
}

export function storyCatalog(boards: InstalledBoardInfo[], layout: BoardLayout): InstalledBoardInfo[] {
  if (layout === 'standard') return boards;
  return [...boards.map(withSecurityReview), INCIDENTS_BOARD];
}

export function storyBoardLanes(layout: BoardLayout): StoryBoardLanes[] {
  if (layout === 'standard') return [{ id: 'work', title: 'Work', lanes: WORK_LANES }];
  return [
    {
      id: 'work',
      title: 'Work',
      lanes: WORK_LANES.flatMap(lane =>
        lane.stage === 'execute' ? [lane, customLane(SECURITY_REVIEW_PHASE)] : [lane],
      ),
    },
    {
      id: INCIDENTS_BOARD.id,
      title: INCIDENTS_BOARD.title,
      lanes: INCIDENTS_BOARD.phases.filter(phase => phase.kind === 'working').map(customLane),
    },
  ];
}

export function storyLane(layout: BoardLayout, stage: string): StoryLane | undefined {
  return storyBoardLanes(layout)
    .flatMap(board => board.lanes)
    .find(lane => lane.stage === stage);
}
