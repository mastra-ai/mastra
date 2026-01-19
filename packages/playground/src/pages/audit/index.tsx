import { AuthRequired, AuditLogList, PageHeader } from '@mastra/playground-ui';

/**
 * Audit log page for viewing security events
 *
 * Requires 'audit:read' permission to access
 */
export function Audit() {
  return (
    <AuthRequired requiredPermissions={['audit:read']}>
      <div className="flex flex-col gap-6 p-6">
        <PageHeader title="Audit Logs" description="View security events and user actions for compliance tracking" />
        <AuditLogList pageSize={50} />
      </div>
    </AuthRequired>
  );
}
