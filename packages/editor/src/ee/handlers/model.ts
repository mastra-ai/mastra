import type { AgentModel } from './types';

/**
 * Resolve the model selection. Returns the `{ provider, name }` pair when both
 * are present, otherwise undefined. Infra-agnostic — no workflow ctx.
 */
export function resolveModel(model?: AgentModel): AgentModel | undefined {
  if (
    model &&
    typeof model.provider === 'string' &&
    model.provider.length > 0 &&
    typeof model.name === 'string' &&
    model.name.length > 0
  ) {
    return { provider: model.provider, name: model.name };
  }
  return undefined;
}
