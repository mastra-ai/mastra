import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { LinearIcon } from '@mastra/playground-ui/icons/LinearIcon';
import { Hand } from 'lucide-react';

import { GitLabIcon, IncidentIoIcon, JiraIcon } from '../../../ui/icons';
import type { IntakeSource } from './intakeMap';

export function SourceIcon({ source }: { source: IntakeSource }) {
  if (source === 'github') return <GithubIcon aria-hidden="true" />;
  if (source === 'gitlab') return <GitLabIcon />;
  if (source === 'linear') return <LinearIcon aria-hidden="true" />;
  if (source === 'jira') return <JiraIcon aria-hidden="true" />;
  if (source === 'incidentio') return <IncidentIoIcon aria-hidden="true" />;
  return <Hand aria-hidden="true" />;
}
