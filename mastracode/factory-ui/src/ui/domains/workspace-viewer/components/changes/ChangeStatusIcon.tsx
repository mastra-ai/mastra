import type { WorkspaceChangeStatus } from '../../../../../api/types';
import { CHANGE_STATUSES } from './change-statuses';

export function ChangeStatusIcon({ status }: { status: WorkspaceChangeStatus }) {
  const { Icon, label, className } = CHANGE_STATUSES[status];
  return <Icon role="img" aria-label={label} className={className} />;
}
