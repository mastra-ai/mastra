import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { SlackIcon } from '@mastra/playground-ui/icons/SlackIcon';
import { cn } from '@mastra/playground-ui/utils/cn';

import { VantaIcon } from '../../../../ui/icons';
import gitlab from './gitlab.svg';
import incidentio from './incidentio.svg';
import jira from './jira.svg';
import linear from './linear.svg';

const brandAssets = { gitlab, incidentio, jira, linear };

type SettingsIntegrationProvider = 'github' | 'gitlab' | 'linear' | 'jira' | 'incidentio' | 'vanta' | 'slack';

export function SettingsIntegrationIcon({
  provider,
  className,
}: {
  provider: SettingsIntegrationProvider;
  className?: string;
}) {
  const iconClassName = cn('size-4 shrink-0', className);

  if (provider === 'github') {
    return <GithubIcon aria-hidden="true" focusable="false" className={iconClassName} />;
  }
  if (provider === 'slack') {
    return <SlackIcon aria-hidden="true" focusable="false" className={iconClassName} />;
  }
  // The same mark Vanta cards show on the board.
  if (provider === 'vanta') {
    return <VantaIcon focusable="false" className={iconClassName} />;
  }

  return <img src={brandAssets[provider]} alt="" aria-hidden="true" className={cn(iconClassName, 'object-contain')} />;
}
