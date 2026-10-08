import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { WorkspacesIcon } from '@mastra/playground-ui/icons/WorkspacesIcon';
import { Activity, FlaskConical, MessageSquare } from 'lucide-react';
import type { NavIcon, NavItem } from '@/lib/nav/nav-items';

export type StudioAreaId = 'chat' | 'build' | 'evaluate' | 'monitor' | 'resources';

interface StudioArea {
  id: StudioAreaId;
  name: string;
  Icon: NavIcon;
  paths: string[];
}

/** Task destinations group capabilities without changing their public URLs. */
export const studioAreas: StudioArea[] = [
  { id: 'chat', name: 'Chat', Icon: MessageSquare, paths: ['/chat'] },
  {
    id: 'build',
    name: 'Build',
    Icon: AgentIcon,
    paths: ['/agents', '/workflows', '/prompts', '/tools', '/processors', '/agent-builder'],
  },
  {
    id: 'evaluate',
    name: 'Evaluate',
    Icon: FlaskConical,
    paths: ['/experiments', '/datasets', '/scorers', '/experiments/review-queue'],
  },
  { id: 'monitor', name: 'Monitor', Icon: Activity, paths: ['/metrics', '/traces', '/logs', '/intelligence'] },
  {
    id: 'resources',
    name: 'Resources',
    Icon: WorkspacesIcon,
    paths: ['/workspaces', '/mcps', '/integrations'],
  },
];

/** Apply grouping after authorization, so every destination has a usable landing page. */
export function getStudioAreaItems(area: StudioArea, authorizedItems: NavItem[]): NavItem[] {
  return area.paths.flatMap(path => authorizedItems.filter(item => item.url === path));
}
