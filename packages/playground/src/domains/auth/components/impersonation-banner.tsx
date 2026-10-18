import { Txt } from '@mastra/playground-ui/components/Txt';
import { Eye, X } from 'lucide-react';

import { useRoleImpersonation } from '../hooks/use-role-impersonation';

/**
 * Banner shown when an admin is previewing the Studio as another role.
 * This is a UI-only preview — server calls still use real admin permissions.
 */
export function ImpersonationBanner() {
  const { isImpersonating, impersonatedRole, stopImpersonation } = useRoleImpersonation();

  if (!isImpersonating || !impersonatedRole) return null;

  return (
    <div className="mx-3 mb-2 flex items-center gap-2 rounded-md border border-info-edge bg-info-subtle px-3 py-1.5">
      <Eye className="h-3.5 w-3.5 shrink-0 text-info-subtle-foreground" />
      <Txt variant="meta" className="truncate text-info-subtle-foreground">
        Previewing <span className="font-medium capitalize">{impersonatedRole.name}</span> experience
      </Txt>
      <button
        type="button"
        onClick={stopImpersonation}
        className="ml-auto shrink-0 rounded p-0.5 text-info-subtle-foreground hover:bg-info-edge"
        title="Exit role preview"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
