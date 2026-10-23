export function reportedUsage(
  value: unknown,
): { inputTokens?: number; outputTokens?: number; totalTokens?: number } | 'unavailable' {
  if (typeof value !== 'object' || value === null) return 'unavailable';
  const fields = value as Record<string, unknown>;
  const number = (key: string) => {
    const field = fields[key];
    if (typeof field === 'number' && Number.isFinite(field)) return field;
    if (typeof field === 'object' && field !== null) {
      const total = (field as Record<string, unknown>).total;
      if (typeof total === 'number' && Number.isFinite(total)) return total;
    }
    return undefined;
  };
  const inputTokens = number('inputTokens') ?? number('promptTokens');
  const outputTokens = number('outputTokens') ?? number('completionTokens');
  const totalTokens =
    number('totalTokens') ??
    (inputTokens !== undefined && outputTokens !== undefined ? inputTokens + outputTokens : undefined);
  return (inputTokens === undefined && outputTokens === undefined && totalTokens === undefined) ||
    (totalTokens === 0 && (inputTokens ?? 0) === 0 && (outputTokens ?? 0) === 0)
    ? 'unavailable'
    : { inputTokens, outputTokens, totalTokens };
}

/** Report the total only when both model calls returned usage. */
export function combinedUsage(first: ReturnType<typeof reportedUsage>, second: ReturnType<typeof reportedUsage>) {
  if (first === 'unavailable' || second === 'unavailable') return 'unavailable' as const;
  const sum = (a: number | undefined, b: number | undefined) =>
    a === undefined || b === undefined ? undefined : a + b;
  return {
    inputTokens: sum(first.inputTokens, second.inputTokens),
    outputTokens: sum(first.outputTokens, second.outputTokens),
    totalTokens: sum(first.totalTokens, second.totalTokens),
  };
}
