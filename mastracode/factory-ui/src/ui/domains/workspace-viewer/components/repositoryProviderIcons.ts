import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import type { ComponentType } from 'react';

import { GitLabIcon } from '../../../ui/icons';
import type { RepositoryProvider } from './changes/tree/change-tree';

export const REPOSITORY_PROVIDER_ICONS: Record<RepositoryProvider, ComponentType<{ className?: string }>> = {
  github: GithubIcon,
  gitlab: GitLabIcon,
};
