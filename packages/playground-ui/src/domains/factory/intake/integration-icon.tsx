import gitlab from './brand-icons/gitlab.svg';
import incidentio from './brand-icons/incidentio.svg';
import jira from './brand-icons/jira.svg';

import linear from './brand-icons/linear.svg';
import { VantaIcon } from './vanta-icon';
import { GithubIcon } from '@/ds/icons/GithubIcon';
import { SlackIcon } from '@/ds/icons/SlackIcon';
import { cn } from '@/utils/cn';

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
