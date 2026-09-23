import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';

/** Shows capability lookup failures as session, permission, or generic error states. */
export function MetricsCapabilityError({ error }: { error: Error }) {
  if (is401UnauthorizedError(error)) return <SessionExpired />;
  if (is403ForbiddenError(error)) return <PermissionDenied resource="metrics" />;
  return <ErrorState title="Failed to load storage capabilities" message={error.message} />;
}
