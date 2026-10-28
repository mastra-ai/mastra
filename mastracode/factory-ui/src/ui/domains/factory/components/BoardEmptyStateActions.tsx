import { Button, buttonVariants } from '@mastra/playground-ui/components/Button';
import { Link } from 'react-router';

import { settingsSectionPath } from '../../settings/settingsSections';

export function BoardEmptyStateActions({
  factoryId,
  connectSource,
  onCreate,
  onClearFilters,
}: {
  factoryId: string;
  connectSource: boolean;
  onCreate?: () => void;
  onClearFilters?: () => void;
}) {
  if (onClearFilters) {
    return (
      <Button size="sm" onClick={onClearFilters}>
        Clear filters
      </Button>
    );
  }

  return (
    <>
      {onCreate && (
        <Button size="sm" onClick={onCreate}>
          Create card
        </Button>
      )}
      {connectSource && (
        <Link to={settingsSectionPath(factoryId, 'intake')} className={buttonVariants({ size: 'sm' })}>
          Connect issue source
        </Link>
      )}
    </>
  );
}
