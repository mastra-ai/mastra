import { Button, buttonVariants } from '@mastra/playground-ui/components/Button';

import { useBoardNavigation } from '../boardNavigation';
import type { IntakeSetup } from './BoardColumnEmptyState';

export function BoardEmptyStateActions({
  boardId,
  intakeSetup,
  onCreate,
  onClearFilters,
}: {
  boardId: string;
  intakeSetup?: IntakeSetup;
  onCreate?: () => void;
  onClearFilters?: () => void;
}) {
  const { LinkComponent: Link, intakeSettingsHref, newIntakeRuleHref } = useBoardNavigation();
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
        <Link href={intakeSettingsHref()} className={buttonVariants({ size: 'sm' })}>
          Connect issue source
        </Link>
      )}
      {intakeSetup === 'route' && (
        <Link href={newIntakeRuleHref(boardId)} className={buttonVariants({ size: 'sm' })}>
          Add intake rule
        </Link>
      )}
    </>
  );
}
