import type { ComponentType, SVGProps } from 'react';

import { GitLabIcon, IncidentIoIcon, JiraIcon, VantaIcon } from './source-icons';
import { IconPageSearch } from '@/ds/icons/central/IconPageSearch';
import { IconPullRequest } from '@/ds/icons/central/IconPullRequest';
import { CircleDotIcon } from '@/ds/icons/CircleDotIcon';
import { GithubIcon } from '@/ds/icons/GithubIcon';
import { LinearIcon } from '@/ds/icons/LinearIcon';
import { SlackIcon } from '@/ds/icons/SlackIcon';

export type CardSource =
  | 'github-issue'
  | 'github-pr'
  | 'github-dependabot-alert'
  | 'gitlab-issue'
  | 'gitlab-pr'
  | 'linear-issue'
  | 'jira-issue'
  | 'incidentio-follow-up'
  | 'vanta-vulnerability'
  | 'detail-finding'
  | 'slack-thread'
  | 'manual';

export interface CardSourcePresentation {
  label: string;
  linkLabel: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconClassName: string;
}

export const CARD_SOURCES: Record<CardSource, CardSourcePresentation> = {
  'github-issue': { label: 'Issue', linkLabel: 'Open in GitHub', Icon: GithubIcon, iconClassName: 'text-foreground' },
  'github-pr': {
    label: 'PR Review',
    linkLabel: 'Open in GitHub',
    Icon: IconPullRequest,
    iconClassName: 'text-muted-foreground',
  },
  'github-dependabot-alert': {
    label: 'Dependabot alert',
    linkLabel: 'Open in GitHub',
    Icon: GithubIcon,
    iconClassName: 'text-foreground',
  },
  'gitlab-issue': {
    label: 'GitLab',
    linkLabel: 'Open in GitLab',
    Icon: GitLabIcon,
    iconClassName: 'text-badge-red-indicator',
  },
  'gitlab-pr': {
    label: 'MR Review',
    linkLabel: 'Open in GitLab',
    Icon: GitLabIcon,
    iconClassName: 'text-badge-red-indicator',
  },
  'linear-issue': {
    label: 'Linear',
    linkLabel: 'Open in Linear',
    Icon: LinearIcon,
    iconClassName: 'text-badge-blue-indicator',
  },
  'jira-issue': {
    label: 'Jira',
    linkLabel: 'Open in Jira',
    Icon: JiraIcon,
    iconClassName: 'text-badge-blue-indicator',
  },
  'incidentio-follow-up': {
    label: 'incident.io',
    linkLabel: 'Open in incident.io',
    Icon: IncidentIoIcon,
    iconClassName: 'text-badge-red-indicator',
  },
  'vanta-vulnerability': { label: 'Vanta', linkLabel: 'Open vulnerability', Icon: VantaIcon, iconClassName: '' },
  'detail-finding': {
    label: 'Detail',
    linkLabel: 'Open finding',
    Icon: IconPageSearch,
    iconClassName: 'text-muted-foreground',
  },
  'slack-thread': { label: 'Slack', linkLabel: 'Open in Slack', Icon: SlackIcon, iconClassName: '' },
  manual: { label: 'Manual', linkLabel: 'Open link', Icon: CircleDotIcon, iconClassName: 'text-muted-foreground' },
};

/** Mirrors Factory's `workItemBoardSource`: the source a board shows a card under. */
export function cardSourceOf(external: { integrationId: string; type: string } | null | undefined): CardSource {
  if (!external) return 'manual';
  switch (external.integrationId) {
    case 'slack':
      return 'slack-thread';
    case 'linear':
      return 'linear-issue';
    case 'gitlab':
      return external.type === 'pull-request' ? 'gitlab-pr' : 'gitlab-issue';
    case 'jira':
      return 'jira-issue';
    case 'incidentio':
      return 'incidentio-follow-up';
    case 'vanta':
      return 'vanta-vulnerability';
    case 'detail':
      return 'detail-finding';
    case 'github':
      if (external.type === 'dependabot-alert') return 'github-dependabot-alert';
      return external.type === 'pull-request' ? 'github-pr' : 'github-issue';
    default:
      return 'manual';
  }
}
