import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { LogsIcon } from '@mastra/playground-ui/icons/LogsIcon';
import { TraceIcon } from '@mastra/playground-ui/icons/TraceIcon';
import { WorkflowIcon } from '@mastra/playground-ui/icons/WorkflowIcon';
import { FlaskConical, MessageSquare } from 'lucide-react';
import type { NavIcon, NavItem } from '@/lib/nav/nav-items';

export type StudioAreaId = 'chat' | 'agents' | 'workflows' | 'traces' | 'evaluate' | 'logs';

interface StudioArea {
  id: StudioAreaId;
  name: string;
  Icon: NavIcon;
  paths: string[];
}

/** Task destinations group capabilities without changing their public URLs. */
export const studioAreas: StudioArea[] = [
  { id: 'chat', name: 'Chat', Icon: MessageSquare, paths: ['/chat'] },
  { id: 'agents', name: 'Agents', Icon: AgentIcon, paths: ['/agents', '/metrics', '/intelligence', '/agent-builder'] },
  { id: 'workflows', name: 'Workflows', Icon: WorkflowIcon, paths: ['/workflows'] },
  { id: 'traces', name: 'Traces', Icon: TraceIcon, paths: ['/traces'] },
  {
    id: 'evaluate',
    name: 'Evaluate',
    Icon: FlaskConical,
    paths: ['/experiments', '/experiments/review-queue', '/datasets'],
  },
  { id: 'logs', name: 'Logs', Icon: LogsIcon, paths: ['/logs'] },
];

/** Building blocks shared by every area: dedicated full-width pages reached from More. */
export const libraryPaths = ['/prompts', '/tools', '/processors', '/scorers', '/workspaces', '/mcps'];

/** Integrations connect to every area, so they stay pinned at the bottom of the rail. */
export const INTEGRATIONS_PATH = '/integrations';

/** Apply grouping after authorization, so every destination has a usable landing page. */
export function getStudioAreaItems(area: StudioArea, authorizedItems: NavItem[]): NavItem[] {
  return area.paths.flatMap(path => authorizedItems.filter(item => item.url === path));
}
