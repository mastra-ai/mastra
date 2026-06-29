/**
 * Compare a model string derived from past messages against the current actor
 * model. Persisted messages from older code paths may carry a bare `modelId`
 * (no `provider/` prefix) while the current actor usually formats as
 * `provider/modelId`. If either side is bare, fall back to comparing just the
 * `modelId` part so a missing provider in history doesn't trigger a spurious
 * provider change. Provider subnamespaces are compared by their base provider
 * (`openai.responses` and `openai` both compare as `openai`) so transport-level
 * provider attribution differences don't trigger provider-change activation.
 */
function parseComparableModelContext(model: string): { provider?: string; modelId: string } {
  const slashIndex = model.indexOf('/');
  if (slashIndex === -1) return { modelId: model };

  return {
    provider: model.slice(0, slashIndex).split('.')[0],
    modelId: model.slice(slashIndex + 1),
  };
}

export function didProviderChange(actorModel?: string, lastModel?: string): boolean {
  if (actorModel === undefined || lastModel === undefined) return false;

  const actorContext = parseComparableModelContext(actorModel);
  const lastContext = parseComparableModelContext(lastModel);

  if (actorContext.modelId !== lastContext.modelId) return true;

  if (actorContext.provider && lastContext.provider) {
    return actorContext.provider !== lastContext.provider;
  }

  return false;
}
