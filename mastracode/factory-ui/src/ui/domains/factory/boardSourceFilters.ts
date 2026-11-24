import { pickedBoardSources, PULL_REQUEST_SOURCE_FILTER } from '@mastra/factory/work-items/card-source-filters';
import type { SourceFilters } from '@mastra/factory/work-items/card-source-filters';

import { CARD_SOURCES } from './cardSources';
import type { SourceGlyph } from './cardSources';

interface BoardSourceOptionShape {
  /** The key the server filters cards by: `boardSource` of each card's source. */
  value: string;
  label: string;
  /** The mark this source's cards show, so the menu and the cards can't drift apart. */
  Icon: SourceGlyph;
  /** Brand colors belong to the mark, independent of the menu's highlight colors. */
  color: string;
}

/** The board's source filter, in menu order. */
export const BOARD_SOURCE_OPTIONS = [
  { value: 'github', label: 'GitHub', Icon: CARD_SOURCES['github-issue'].Icon, color: 'var(--foreground)' },
  { value: 'gitlab', label: 'GitLab', Icon: CARD_SOURCES['gitlab-issue'].Icon, color: '#FC6D26' },
  { value: 'linear', label: 'Linear', Icon: CARD_SOURCES['linear-issue'].Icon, color: '#5E6AD2' },
  { value: 'jira', label: 'Jira', Icon: CARD_SOURCES['jira-issue'].Icon, color: '#1868DB' },
  { value: 'incidentio', label: 'incident.io', Icon: CARD_SOURCES['incidentio-follow-up'].Icon, color: '#F2555A' },
  { value: 'vanta', label: 'Vanta', Icon: CARD_SOURCES['vanta-vulnerability'].Icon, color: '#7B4DFF' },
  { value: 'detail', label: 'Detail', Icon: CARD_SOURCES['detail-finding'].Icon, color: 'var(--muted-foreground)' },
  { value: 'manual', label: 'Manual', Icon: CARD_SOURCES.manual.Icon, color: 'var(--muted-foreground)' },
  // Not a provider: any card carrying a pull or merge request, its own or attached to its issue.
  {
    value: PULL_REQUEST_SOURCE_FILTER,
    label: 'Pull requests',
    Icon: CARD_SOURCES['github-pr'].Icon,
    color: 'var(--muted-foreground)',
  },
] as const satisfies readonly BoardSourceOptionShape[];

export type BoardSourceOption = (typeof BOARD_SOURCE_OPTIONS)[number];

/** Source and project filters determine which intake feeds to browse. */
export function hasBoardSourceFilters(filters: SourceFilters): boolean {
  return pickedBoardSources(filters).size > 0;
}
