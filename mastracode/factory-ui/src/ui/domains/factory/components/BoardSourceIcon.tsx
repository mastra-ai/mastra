import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { LinearIcon } from '@mastra/playground-ui/icons/LinearIcon';
import { CircleDot } from 'lucide-react';

import { GitLabIcon, IncidentIoIcon, JiraIcon } from '../../../ui/icons';
import type { BOARD_SOURCE_OPTIONS } from '../boardSourceFilters';

type BoardSource = (typeof BOARD_SOURCE_OPTIONS)[number]['value'];

const SOURCE_MARKS = {
  github: { Icon: GithubIcon, color: 'var(--foreground)' },
  gitlab: { Icon: GitLabIcon, color: '#FC6D26' },
  linear: { Icon: LinearIcon, color: '#5E6AD2' },
  jira: { Icon: JiraIcon, color: '#1868DB' },
  incidentio: { Icon: IncidentIoIcon, color: '#F2555A' },
  manual: { Icon: CircleDot, color: 'var(--muted-foreground)' },
};

/** Brand colors belong to the SVG mark, independent of menu highlight colors. */
export function BoardSourceIcon({ source }: { source: BoardSource }) {
  const { Icon, color } = SOURCE_MARKS[source];
  return (
    <span className="flex size-4 shrink-0 items-center justify-center" style={{ color }} aria-hidden>
      <Icon className="size-4" />
    </span>
  );
}
