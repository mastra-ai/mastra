import type { MastraCodeState } from '@mastra/code-sdk/schema';
import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';

import { resolveFactorySessionAddress } from '../rules/binding-context.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { resolveFactoryToolScope } from '../tools/scope.js';
import type { SourceControlSessionLookup } from './factory-session.js';
import { PLAN_REVIEW_INSTRUCTIONS } from './plan-review-instructions.js';

type SessionController = AgentControllerRequestContext<MastraCodeState>;

interface FactoryHostInstructionsDeps {
  workItems: Pick<WorkItemsStorage, 'findActiveRunBindingByThread' | 'get' | 'hasRunBindingForSession'>;
  projects: Pick<FactoryProjectsStorage, 'get'>;
  authEnabled: () => boolean;
  readySourceControlSessions: () => Pick<SourceControlSessionLookup, 'getBySessionId'> | undefined;
}

// The SDK reads repository AGENTS.md right after this, so trust is healed first.
export function createFactoryHostInstructions(deps: FactoryHostInstructionsDeps) {
  return async ({ requestContext }: { requestContext: RequestContext }): Promise<string | undefined> => {
    const controller = requestContext.get('controller') as SessionController | undefined;
    if (!controller?.threadId || !controller.sessionId) return undefined;
    const binding = await restoreTrustStateBeforePrompt(controller, requestContext, deps);
    if (binding === 'bound' || requestContext.get('channel')) return undefined;
    const sessions = deps.readySourceControlSessions();
    if (!sessions) return undefined;
    const scope = await resolveFactoryToolScope({
      requestContext,
      authEnabled: deps.authEnabled(),
      sessions,
      projects: deps.projects,
      workItems: deps.workItems,
    });
    return scope?.kind === 'user' && scope.interactive ? PLAN_REVIEW_INSTRUCTIONS : undefined;
  };
}

// Only the start coordinator and the binding heal write `untrustedCheckout`, so a complete trust state was bound.
async function restoreTrustStateBeforePrompt(
  controller: SessionController,
  requestContext: RequestContext,
  deps: FactoryHostInstructionsDeps,
): Promise<'bound' | 'unbound'> {
  const current = controller.getState();
  const trustStateComplete =
    Boolean(current.factoryProjectId) &&
    Boolean(current.factoryOrgId) &&
    typeof current.untrustedCheckout === 'boolean';
  if (trustStateComplete) return 'bound';
  const sessions = deps.readySourceControlSessions();
  const recovered = await resolveFactorySessionAddress({
    requestContext,
    storage: deps.workItems,
    forceBindingLookup: true,
    ...(sessions ? { sessions } : {}),
  });
  if (!recovered?.binding) return 'unbound';
  const state = controller.getState();
  if (
    state.factoryProjectId !== recovered.binding.factoryProjectId ||
    (recovered.binding.role === 'review' && state.untrustedCheckout !== true)
  ) {
    throw new Error('Factory review session security state could not be restored before prompt creation.');
  }
  return 'bound';
}
