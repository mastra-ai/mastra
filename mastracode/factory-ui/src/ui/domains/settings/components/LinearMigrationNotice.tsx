import { Notice } from '@mastra/playground-ui/components/Notice';
import { RotateCcw } from 'lucide-react';

import { useMigrateLinearMutation } from '../../../../hooks/useLinearConnect';
import { useOrgKeyAdminQuery } from '../../../../hooks/use-providers';
import type { LinearMigrationStatus } from '../../factory/services/linear';

/**
 * The server moves the org's Linear workspaces from the platform's legacy
 * connection onto Mastra Connect by itself. This shows that move while it's
 * pending and, when it stalls, lets an organization admin retry it now.
 */
export function LinearMigrationNotice({ migration }: { migration: LinearMigrationStatus }) {
  const admin = useOrgKeyAdminQuery().data === true;
  const retry = useMigrateLinearMutation();
  const stalled = Boolean(migration.lastError) || migration.skipped.length > 0;
  if (!migration.required && !stalled) return null;

  const count = migration.pending.length;
  const workspaces = count === 1 ? '1 Linear workspace' : `${count} Linear workspaces`;
  if (!stalled) {
    return (
      <Notice variant="info" title="Moving Linear to Mastra Connect">
        <Notice.Message>
          Factory is moving {workspaces} to Mastra Connect. Their intake resumes when the move finishes.
        </Notice.Message>
      </Notice>
    );
  }
  return (
    <Notice
      variant="warning"
      title="Linear workspaces haven't moved to Mastra Connect"
      action={
        admin && (
          <Notice.Button icon={<RotateCcw />} disabled={retry.isPending} onClick={() => retry.mutate()}>
            {retry.isPending ? 'Retrying…' : 'Retry now'}
          </Notice.Button>
        )
      }
    >
      <Notice.Message>
        {migration.lastError?.message ?? "The platform couldn't move some workspaces."} Factory keeps retrying on its
        own.
      </Notice.Message>
      {migration.skipped.length > 0 && (
        <ul aria-label="Linear workspaces not moved" className="list-disc pl-5">
          {migration.skipped.map(skipped => (
            <li key={skipped.linearWorkspaceId}>
              {skipped.linearWorkspaceId}: {skipped.reason}
            </li>
          ))}
        </ul>
      )}
      {admin && (
        <Notice.Message>
          The move covers every Factory in this organization and can't be undone. Factory deployments that haven't been
          upgraded lose Linear access until they are.
        </Notice.Message>
      )}
    </Notice>
  );
}
