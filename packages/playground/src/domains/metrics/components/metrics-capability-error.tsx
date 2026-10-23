import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';

/** Shows capability lookup failures as session, permission, or generic error states. */
export function MetricsCapabilityError({ error }: { error: Error }) {
  if (is401UnauthorizedError(error)) return <SessionExpired />;
  if (is403ForbiddenError(error)) return <PermissionDenied resource="metrics" />;
  return <EmptyState tone="error" titleSlot="Failed to load storage capabilities" descriptionSlot={error.message} />;
}
