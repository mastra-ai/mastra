import { Spinner } from '@mastra/playground-ui';

import { usePermissionPatterns } from '../hooks/use-permission-patterns';
import { ALL_SIDEBAR_PERMISSIONS } from '../route-permissions';

/**
 * Async replacement for the old static `P()` validator.
 *
 * On `main`, every route-permission literal was validated at module-eval time
 * against `PERMISSION_PATTERNS` imported synchronously from
 * `@mastra/core/auth/ee` — invalid literals threw immediately. We no longer
 * import the server-only EE code into the browser, so the authoritative pattern
 * vocabulary is fetched from `GET /auth/permission-patterns` instead.
 *
 * This gate is the single place that bridges that gap:
 * - while the patterns load, it renders a spinner (no children, no gating
 *   decisions made against an empty pattern set);
 * - once loaded, it validates every route-permission literal and throws on an
 *   invalid one (same fail-fast semantics as the old `P()`), surfacing via the
 *   app error boundary;
 * - otherwise it renders its children.
 *
 * Mounted once near the top of the app (see App.tsx), so every downstream
 * consumer (`RoutePermissionGuard`, `StudioIndexRedirect`, the sidebar) can
 * assume patterns are loaded and valid and only wait on the user's own
 * permissions.
 *
 * When RBAC is disabled, `usePermissionPatterns` resolves immediately with an
 * empty set and no request — route gating is a no-op, so the gate renders
 * children without validating.
 */
export function RoutePermissionsGate({ children }: { children: React.ReactNode }) {
  const { patterns, isLoading } = usePermissionPatterns();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // Only validate when RBAC is actually in effect (non-empty pattern set).
  // RBAC-off resolves with an empty set and gating is a no-op.
  if (patterns.size > 0) {
    for (const literal of ALL_SIDEBAR_PERMISSIONS) {
      if (!patterns.has(literal)) {
        throw new Error(
          `Invalid permission pattern: "${literal}". It is not in the server's ` +
            `PERMISSION_PATTERNS — check for a typo in route-permissions.ts.`,
        );
      }
    }
  }

  return <>{children}</>;
}
