import { PermissionDenied } from '@mastra/playground-ui';

export default function NoAccess() {
  return (
    <div className="flex items-center justify-center h-full">
      <PermissionDenied
        title="No Access"
        description="You don't have permission to access any resources in Mastra Studio. Contact your administrator for access."
      />
    </div>
  );
}
