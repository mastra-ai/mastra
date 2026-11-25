import { IconPageSearch } from '@mastra/playground-ui/icons/central/IconPageSearch';
import { IconPullRequest } from '@mastra/playground-ui/icons/central/IconPullRequest';
import { CircleDotIcon } from '@mastra/playground-ui/icons/CircleDotIcon';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { LinearIcon } from '@mastra/playground-ui/icons/LinearIcon';
import { SlackIcon } from '@mastra/playground-ui/icons/SlackIcon';
import type { ComponentType, SVGProps } from 'react';

import { GitLabIcon, IncidentIoIcon, JiraIcon, VantaIcon } from '../../ui/icons';
import type { WorkItemSource } from './services/workItems';

/** A mark that takes SVG props, so it can be sized and stamped with data and aria attributes. */
export type SourceGlyph = ComponentType<SVGProps<SVGSVGElement>>;

/** How the board presents one place a card can come from. */
export interface CardSourcePresentation {
  /** Read out before the card's title, and shown in its meta when the card has no key. */
  label: string;
  /** Names where the card's upstream link goes: `Open in GitHub`. */
  linkLabel: string;
  Icon: SourceGlyph;
  /** The mark's tone. Marks drawn in their own brand colors leave it empty. */
  iconClassName: string;
}

/**
 * Every place a card can come from, keyed by the server's own source vocabulary. A source the
 * server adds fails the typecheck here until it has a label, a link label and a mark, rather than
 * showing as a card filed by hand.
 */
export const CARD_SOURCES: Record<WorkItemSource, CardSourcePresentation> = {
  'github-issue': { label: 'Issue', linkLabel: 'Open in GitHub', Icon: GithubIcon, iconClassName: 'text-foreground' },
  // GitHub keeps issue vs PR distinct: card meta shows #N for both.
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
  // Vanta links to the vulnerability in the scanner that reported it, not to Vanta itself.
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
