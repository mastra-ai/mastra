import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { ExternalLink } from 'lucide-react';

import { useAuditPortalLink } from '../../../../../../hooks/useAuditEvents';

export function AuditPortalItem() {
  const portalQuery = useAuditPortalLink(true);
  const portalUrl = portalQuery.data;
  if (!portalUrl) return null;

  return (
    <DropdownMenu.Item
      onClick={() => {
        window.open(portalUrl, '_blank', 'noopener,noreferrer');
        void portalQuery.refetch();
      }}
    >
      <ExternalLink aria-hidden />
      <span>Open audit log in WorkOS</span>
    </DropdownMenu.Item>
  );
}
