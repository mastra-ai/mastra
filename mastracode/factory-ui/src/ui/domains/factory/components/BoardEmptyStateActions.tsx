import { Button, buttonVariants } from '@mastra/playground-ui/components/Button';
import { Link } from 'react-router';

import { settingsSectionPath } from '../../settings/settingsSections';
import type { BoardKind } from '../boardStages';

export function BoardEmptyStateActions({
  factoryId,
  kind,
  connectSource,
  onCreate,
  onClearFilters,
}: {
  factoryId: string;
  kind: BoardKind;
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

  const review = kind === 'review';
  return (
    <>
      {onCreate && (
        <Button size="sm" onClick={onCreate}>
          Create card
        </Button>
      )}
      {connectSource && (
        <Link
          to={settingsSectionPath(factoryId, review ? 'repositories' : 'intake')}
          className={buttonVariants({ size: 'sm' })}
        >
          {review ? 'Connect repository' : 'Connect issue source'}
        </Link>
      )}
    </>
  );
}
