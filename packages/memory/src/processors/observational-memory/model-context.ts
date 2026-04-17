/**
 * Compare a model string derived from past messages against the current actor
 * model. Persisted messages from older code paths may carry a bare `modelId`
 * (no `provider/` prefix) while the current actor always formats as
 * `provider/modelId`. If either side is bare, fall back to comparing just the
 * `modelId` part so a missing provider in history doesn't trigger a spurious
 * provider change.
 */
export function didProviderChange(actorModel?: string, lastModel?: string): boolean {
  if (actorModel === undefined || lastModel === undefined) return false;

  const actorHasSlash = actorModel.includes('/');
  const lastHasSlash = lastModel.includes('/');

  if (actorHasSlash && lastHasSlash) {
    return actorModel !== lastModel;
  }

  const actorModelId = actorHasSlash ? actorModel.slice(actorModel.indexOf('/') + 1) : actorModel;
  const lastModelId = lastHasSlash ? lastModel.slice(lastModel.indexOf('/') + 1) : lastModel;
  return actorModelId !== lastModelId;
}
