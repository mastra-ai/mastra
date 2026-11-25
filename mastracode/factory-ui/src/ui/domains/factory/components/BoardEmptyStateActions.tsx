import { Button, buttonVariants } from '@mastra/playground-ui/components/Button';
import { Link } from 'react-router';

import { boardRulesPath } from '../../boardConfig/boardConfigPaths';
import { settingsSectionPath } from '../../settings/settingsSections';
import type { IntakeSetup } from './BoardColumnEmptyState';

export function BoardEmptyStateActions({
  factoryId,
  boardId,
  intakeSetup,
  onCreate,
  onClearFilters,
}: {
  factoryId: string;
  boardId: string;
  intakeSetup?: IntakeSetup;
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
      {intakeSetup === 'source' && (
        <Link to={settingsSectionPath(factoryId, 'intake')} className={buttonVariants({ size: 'sm' })}>
          Connect issue source
        </Link>
      )}
      {intakeSetup === 'route' && (
        <Link to={boardRulesPath(factoryId, boardId)} className={buttonVariants({ size: 'sm' })}>
          Add intake rule
        </Link>
      )}
    </>
  );
}
