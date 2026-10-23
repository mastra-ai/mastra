import { Txt } from '@mastra/playground-ui/components/Txt';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { GitLabIcon } from '../../../../../ui/icons';
import type { RepositoryProvider } from './change-tree';

interface RepositoryGroupHeaderProps {
  label: string;
  provider?: RepositoryProvider;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: ReactNode;
}

/** The collapsible row a repository's files sit under when the session holds several repositories. */
export function RepositoryGroupHeader({ label, provider, open, onOpenChange, children }: RepositoryGroupHeaderProps) {
  return (
    <button
      type="button"
      className="flex min-h-8 w-full items-center gap-1.5 px-2 text-left"
      aria-expanded={open}
      aria-label={`${open ? 'Hide' : 'Show'} files in ${label}`}
      data-testid="workspace-repository-group"
      onClick={() => onOpenChange(!open)}
    >
      {open ? (
        <ChevronDown className="text-muted-foreground shrink-0" size={14} />
      ) : (
        <ChevronRight className="text-muted-foreground shrink-0" size={14} />
      )}
      {provider ? (
        <span aria-hidden="true" className="flex shrink-0 items-center" data-testid={`repository-provider-${provider}`}>
          {provider === 'gitlab' ? (
            <GitLabIcon className="text-foreground size-3.5 shrink-0" />
          ) : (
            <GithubIcon className="text-foreground size-3.5 shrink-0" />
          )}
        </span>
      ) : null}
      <Txt as="span" tone="ink" variant="column" font="mono" className="min-w-0 flex-1 truncate">
        {label}
      </Txt>
      {children}
    </button>
  );
}
