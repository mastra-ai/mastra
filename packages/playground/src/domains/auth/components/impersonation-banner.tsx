import { Txt } from '@mastra/playground-ui';
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
    <div className="flex items-center gap-2 bg-info1/10 border border-info1/20 rounded-md mx-3 mb-2 px-3 py-1.5">
      <Eye className="h-3.5 w-3.5 text-info1 shrink-0" />
      <Txt variant="ui-xs" className="text-info1 truncate">
        Previewing <span className="font-medium capitalize">{impersonatedRole.name}</span> experience
      </Txt>
      <button
        type="button"
        onClick={stopImpersonation}
        className="ml-auto shrink-0 rounded p-0.5 text-info1 hover:bg-info1/20 transition-colors"
        title="Exit role preview"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
