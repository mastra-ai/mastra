import { cn } from '@mastra/playground-ui/utils/cn';

import type { WorkspaceChangeStatus } from '../../../../../api/types';
import { CHANGE_STATUSES } from './change-statuses';

export function ChangeStatusLetter({ status }: { status: WorkspaceChangeStatus }) {
  const { label, letter, className } = CHANGE_STATUSES[status];
  const name = `${label} on this branch`;
  return (
    <span
      role="img"
      title={name}
      aria-label={name}
      className={cn('text-caption ml-auto w-4 shrink-0 text-center font-mono font-medium', className)}
    >
      {letter}
    </span>
  );
}
