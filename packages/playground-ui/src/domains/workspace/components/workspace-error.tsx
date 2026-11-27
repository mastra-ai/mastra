import { describeWorkspaceError } from './workspace-error-message';
import { Notice } from '@/ds/components/Notice';

export function WorkspaceError({
  error,
  fallback,
  className,
}: {
  error?: Error;
  fallback: string;
  className?: string;
}) {
  return (
    <Notice variant="destructive" className={className}>
      <Notice.Message>{describeWorkspaceError(error, fallback)}</Notice.Message>
    </Notice>
  );
}
