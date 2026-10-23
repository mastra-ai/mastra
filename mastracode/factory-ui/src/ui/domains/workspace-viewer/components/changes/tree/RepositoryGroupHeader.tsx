import { DisclosureChevron } from '@mastra/playground-ui/components/DisclosureChevron';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import type { ComponentType, ReactNode } from 'react';

import { GitLabIcon } from '../../../../../ui/icons';
import type { RepositoryProvider } from './change-tree';

const PROVIDER_ICONS: Record<RepositoryProvider, ComponentType<{ className?: string }>> = {
  github: GithubIcon,
  gitlab: GitLabIcon,
};

interface RepositoryGroupHeaderProps {
  label: string;
  provider?: RepositoryProvider;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: ReactNode;
}

export function RepositoryGroupHeader({ label, provider, open, onOpenChange, children }: RepositoryGroupHeaderProps) {
  const ProviderIcon = provider && PROVIDER_ICONS[provider];
  return (
    <button
      type="button"
      className="flex min-h-8 w-full items-center gap-1.5 px-2 text-left"
      aria-expanded={open}
      aria-label={`${open ? 'Hide' : 'Show'} files in ${label}`}
      data-testid="workspace-repository-group"
      onClick={() => onOpenChange(!open)}
    >
      <DisclosureChevron direction="right" className="text-muted-foreground size-3.5" />
      {ProviderIcon ? (
        <span aria-hidden="true" className="flex shrink-0 items-center" data-testid={`repository-provider-${provider}`}>
          <ProviderIcon className="text-foreground size-3.5 shrink-0" />
        </span>
      ) : null}
      <Txt as="span" tone="ink" variant="column" font="mono" className="min-w-0 flex-1 truncate">
        {label}
      </Txt>
      {children}
    </button>
  );
}
