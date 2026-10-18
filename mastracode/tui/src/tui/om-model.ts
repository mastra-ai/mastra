import { getActiveRouteMemoryModelId } from '@mastra/code-sdk/agents/model';
import { resolveAutoOMModelId } from '@mastra/code-sdk/onboarding/packs';
import type { Session } from '@mastra/core/agent-controller';

/**
 * The model an OM role actually runs. The active model route's memory model is
 * more specific than the `/om` role setting, so it wins while that route is
 * active.
 */
export function getEffectiveOMRoleModelId(session: Session<any>, role: 'observer' | 'reflector'): string | undefined {
  const routeMemoryModelId = getActiveRouteMemoryModelId(
    session.state.get() as Record<string, unknown> | undefined,
    session.thread.getId(),
  );
  if (routeMemoryModelId === 'auto') return resolveAutoOMModelId(session.model.get() ?? undefined);
  return routeMemoryModelId ?? session.om[role].modelId();
}
