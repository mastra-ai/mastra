import type { PermissionPolicy, PermissionRules } from '@mastra/core/agent-controller';

import type { SourceControlSessionLookup } from '../session/factory-session.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';

/**
 * Factory tools that run without asking. Factory tools fall into the SDK's
 * `mcp` category, whose default policy is `ask`, so each of these needs an
 * explicit per-session `allow`.
 */
export const FACTORY_TOOLS_WITHOUT_APPROVAL: readonly string[] = [
  'factory_list_work_items',
  'factory_inspect_work_item',
  'factory_list_attention',
  'factory_create_work_item',
  'factory_update_work_item',
  'factory_transition_work_item',
  'factory_retry_decision',
  'factory_dismiss_decision',
  'factory_resolve_proposal',
  'factory_subscribe_work_item',
  'factory_unsubscribe_work_item',
  'factory_signal_session',
  'factory_message_origin',
  'factory_start_session',
  'factory_answer_approval',
];

export interface FactoryToolPermissionsSession {
  readonly identity: { getResourceId(): string };
  readonly permissions: {
    getRules(): PermissionRules;
    setForTool(args: { toolName: string; policy: PermissionPolicy }): Promise<void>;
  };
}

export interface FactoryToolPermissionsDependencies {
  sessions: Pick<SourceControlSessionLookup, 'getBySessionId'>;
  workItems: Pick<WorkItemsStorage, 'hasRunBindingForSession'>;
}

/** All a work or side session gets from the Factory tools: reporting back. */
export const FACTORY_WORKER_TOOLS_WITHOUT_APPROVAL: readonly string[] = ['factory_message_origin'];

/**
 * Allow the no-approval Factory tools on a newly created Factory session.
 * This only sets policy; which tools a turn actually gets is decided by the
 * tool scope. A person's own choices win: a per-tool policy is never
 * overwritten, and an explicit `mcp` category policy leaves everything alone.
 */
export async function applyFactoryToolPermissions(
  session: FactoryToolPermissionsSession,
  { sessions, workItems }: FactoryToolPermissionsDependencies,
  toolNames: readonly string[] = FACTORY_TOOLS_WITHOUT_APPROVAL,
): Promise<void> {
  const row = await sessions.getBySessionId(session.identity.getResourceId());
  if (!row?.factoryProjectId) return;
  const rules = session.permissions.getRules();
  if (rules.categories.mcp !== undefined) return;
  // Work and side sessions only report back. Their own tools (a role's stage moves)
  // share names with user-session tools and must keep asking.
  const worker =
    (row.originSessionId !== null && row.originSessionId !== undefined) ||
    (await workItems.hasRunBindingForSession({
      orgId: row.orgId,
      factoryProjectId: row.factoryProjectId,
      sessionId: row.sessionId,
    }));
  for (const toolName of worker ? FACTORY_WORKER_TOOLS_WITHOUT_APPROVAL : toolNames) {
    if (session.permissions.getRules().tools[toolName] !== undefined) continue;
    await session.permissions.setForTool({ toolName, policy: 'allow' });
  }
}
