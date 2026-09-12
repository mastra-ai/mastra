export function withGraphStepId<TStep extends { id: string }>(step: TStep, graphStepId: string) {
  return {
    ...step,
    id: `processor:${graphStepId}`,
  };
}
