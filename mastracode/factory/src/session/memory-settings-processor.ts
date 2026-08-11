import type { MastraCodeState } from '@mastra/code-sdk/schema';
import type { AgentController } from '@mastra/core/agent-controller';
import type { ProcessInputArgs, ProcessInputResult, Processor } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';

import { getFactoryAuthOrgId, getFactoryAuthUserFromContext, getFactoryAuthUserId } from '../auth.js';
import type { MemorySettingsStorage } from '../storage/domains/memory-settings/base.js';
import { applyMemorySettingsToSession, resolveMemorySettingsIdentity } from './memory-settings.js';

type FactoryController = Pick<AgentController<MastraCodeState>, 'getSessionByResource'>;

interface SessionTarget {
  resourceId: string;
  scope?: string;
}

/** The session this run addresses, from the controller entry on the request context. */
function getSessionTarget(requestContext: RequestContext | undefined): SessionTarget | undefined {
  if (!requestContext || typeof requestContext.get !== 'function') return undefined;
  const context = requestContext.get('controller');
  if (typeof context !== 'object' || context === null) return undefined;
  const resourceId = 'resourceId' in context ? context.resourceId : undefined;
  const scope = 'scope' in context ? context.scope : undefined;
  if (typeof resourceId !== 'string' || !resourceId) return undefined;
  return { resourceId, ...(typeof scope === 'string' && scope ? { scope } : {}) };
}

/**
 * Re-apply the caller's stored memory settings to their live session at the
 * start of every run.
 *
 * Sessions are seeded once at creation, but a long-lived one — an autonomous
 * review, a chat left open — outlives that snapshot: change the OM model in
 * settings and the running session keeps calling the old one, failing forever
 * when that was the point of the change. The stored row is authoritative, so
 * reconcile against it rather than hoping a write reached every session.
 */
export class FactoryMemorySettingsProcessor implements Processor<'factory-memory-settings'> {
  readonly id = 'factory-memory-settings';

  constructor(
    private readonly options: {
      memorySettings: MemorySettingsStorage;
      getController: () => FactoryController | undefined;
      authEnabled: boolean;
    },
  ) {}

  async processInput(args: ProcessInputArgs): Promise<ProcessInputResult> {
    const target = getSessionTarget(args.requestContext);
    const user = getFactoryAuthUserFromContext(args.requestContext);
    const userId = getFactoryAuthUserId(user);
    const identity = resolveMemorySettingsIdentity({
      tenant: userId ? { orgId: getFactoryAuthOrgId(user), userId } : undefined,
      authEnabled: this.options.authEnabled,
    });
    if (!target || !identity) return args.messageList;

    try {
      await this.options.memorySettings.ensureReady();
    } catch {
      // A settings row we cannot read must not block the user's message.
      return args.messageList;
    }
    const session = await this.options.getController()?.getSessionByResource(target.resourceId, target.scope);
    if (session) {
      await applyMemorySettingsToSession(session, await this.options.memorySettings.get(identity));
    }
    return args.messageList;
  }
}
