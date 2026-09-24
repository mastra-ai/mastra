import { getActivePackMemoryModelId } from '@mastra/code-sdk/agents/model';
import { resolveAutoOMModelId } from '@mastra/code-sdk/onboarding/packs';
import { loadSettings } from '@mastra/code-sdk/onboarding/settings';
import type { Session } from '@mastra/core/agent-controller';

/**
 * The model an OM role actually runs. An active pack's memory model is more
 * specific than the `/om` role setting, so it wins while that pack is active.
 */
export function getEffectiveOMRoleModelId(session: Session<any>, role: 'observer' | 'reflector'): string | undefined {
  const packMemoryModelId = getActivePackMemoryModelId(
    loadSettings(),
    session.state.get() as Record<string, unknown> | undefined,
    session.thread.getId(),
  );
  if (packMemoryModelId === 'auto') return resolveAutoOMModelId(session.model.get() ?? undefined);
  return packMemoryModelId ?? session.om[role].modelId();
}
