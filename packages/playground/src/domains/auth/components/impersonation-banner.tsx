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
    <div className="bg-info-subtle border-info-edge mx-3 mb-2 flex items-center gap-2 rounded-md border px-3 py-1.5">
      <Eye className="text-info-subtle-foreground h-3.5 w-3.5 shrink-0" />
      <Txt variant="meta" className="text-info-subtle-foreground truncate">
        Previewing <span className="font-medium capitalize">{impersonatedRole.name}</span> experience
      </Txt>
      <button
        type="button"
        onClick={stopImpersonation}
        className="text-info-subtle-foreground hover:bg-info-indicator/20 ml-auto shrink-0 rounded p-0.5"
        title="Exit role preview"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
