import { buttonVariants } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Link } from 'react-router';

import { settingsSectionPath } from '../../settings/settingsSections';
import { IconBranch } from '@mastra/playground-ui/icons/central/IconBranch';

export function ConnectRepositoryEmptyState({ factoryId }: { factoryId: string }) {
  return (
    <EmptyState
      variant="fill"
      as="h2"
      iconSlot={<IconBranch />}
      titleSlot="Connect a repository to start intake"
      descriptionSlot="Link a repository in Repository settings. Its issues will appear in Intake, ready to move through planning and build."
      actionSlot={
        <Link to={settingsSectionPath(factoryId, 'repositories')} className={buttonVariants({ variant: 'primary' })}>
          Open Repository settings
        </Link>
      }
    />
  );
}
