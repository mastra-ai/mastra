import type { PermissionPolicy, PermissionRules } from '@mastra/core/agent-controller';

import type { SourceControlSessionLookup } from '../session/factory-session.js';

/**
 * Factory tools that run without asking. Factory tools fall into the SDK's
 * `mcp` category, whose default policy is `ask`, so each of these needs an
 * explicit per-session `allow`. Approval-gated tools never appear here.
 */
export const FACTORY_TOOLS_WITHOUT_APPROVAL: readonly string[] = [];

export interface FactoryToolPermissionsSession {
  readonly identity: { getResourceId(): string };
  readonly permissions: {
    getRules(): PermissionRules;
    setForTool(args: { toolName: string; policy: PermissionPolicy }): Promise<void>;
  };
}

export interface FactoryToolPermissionsDependencies {
  sessions: Pick<SourceControlSessionLookup, 'getBySessionId'>;
}

/**
 * Allow the no-approval Factory tools on a newly created Factory session.
 * This only sets policy; which tools a turn actually gets is decided by the
 * tool scope. A person's own choices win: a per-tool policy is never
 * overwritten, and an explicit `mcp` category policy leaves everything alone.
 */
export async function applyFactoryToolPermissions(
  session: FactoryToolPermissionsSession,
  { sessions }: FactoryToolPermissionsDependencies,
  toolNames: readonly string[] = FACTORY_TOOLS_WITHOUT_APPROVAL,
): Promise<void> {
  const row = await sessions.getBySessionId(session.identity.getResourceId());
  if (!row?.factoryProjectId) return;
  const rules = session.permissions.getRules();
  if (rules.categories.mcp !== undefined) return;
  for (const toolName of toolNames) {
    if (session.permissions.getRules().tools[toolName] !== undefined) continue;
    await session.permissions.setForTool({ toolName, policy: 'allow' });
  }
}
