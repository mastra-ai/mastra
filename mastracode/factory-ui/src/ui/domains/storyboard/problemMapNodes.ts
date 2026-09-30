import { ANSWERS } from './problemMapAnswers';
import { CALL_NODES } from './problemMapCall';
import { NEEDS } from './problemMapNeeds';

export type MapColumn = 'problem' | 'solution' | 'risk' | 'fix';
export type MapSource = 'Transcript' | 'Slack' | 'Codex' | 'Excalidraw 1' | 'Excalidraw 2' | 'Call 2';

export type MapNode = {
  column: MapColumn;
  label: string;
  detail: string;
  sources: MapSource[];
  story: string | null;
  open: boolean;
};

const NODES = { ...NEEDS, ...ANSWERS, ...CALL_NODES };

export type MapNodeId = keyof typeof NODES;
export const PROBLEM_MAP_NODES: Record<MapNodeId, MapNode> = NODES;
