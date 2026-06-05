import type { Agent } from '@mastra/core/agent';
import { z } from 'zod-v4';

import type { AgentModel } from '../../types';

const modelSelectionSchema = z.object({
  provider: z.string().min(1).describe('The chosen model provider'),
  name: z.string().min(1).describe('The chosen model name'),
});

function isValidModel(model?: AgentModel): model is AgentModel {
  return (
    !!model &&
    typeof model.provider === 'string' &&
    model.provider.length > 0 &&
    typeof model.name === 'string' &&
    model.name.length > 0
  );
}

/**
 * Resolve the model selection as a `{ provider, name }` pair.
 *
 * If an explicit, valid model is provided it is used as-is. Otherwise, when a
 * list of `availableModels` is supplied, the injected agent picks one from that
 * list. If neither yields a model, returns undefined.
 *
 * Infra-agnostic: receives a ready-to-use `Agent` (dependency-injected by the
 * step) and explicit domain args, never a workflow `ctx`.
 */
export async function resolveModel(
  agent: Agent,
  model?: AgentModel,
  availableModels?: AgentModel[],
): Promise<AgentModel | undefined> {
  if (isValidModel(model)) {
    return { provider: model.provider, name: model.name };
  }

  if (!availableModels || availableModels.length === 0) {
    return undefined;
  }

  const result = await agent.generate(
    `Choose the most appropriate model for the agent from this list:\n\n${JSON.stringify(availableModels)}`,
    { structuredOutput: { schema: modelSelectionSchema } },
  );

  const chosen = result.object;
  const match = availableModels.find(
    candidate => candidate.provider === chosen.provider && candidate.name === chosen.name,
  );
  return match ? { provider: match.provider, name: match.name } : undefined;
}
