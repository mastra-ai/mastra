/**
 * Normalize `resumeGenerate` arguments for durable agents.
 *
 * Accepts the `Agent` signature `(resumeData, { runId, ...options })` and the
 * deprecated durable-only signature `(runId, resumeData, options?)`.
 */
export function normalizeResumeGenerateArgs<TOptions extends Record<string, any>>(
  args: unknown[],
): { runId: string; resumeData: unknown; options: TOptions } {
  const [first, second, third] = args;
  const secondRunId =
    second && typeof second === 'object' && typeof (second as { runId?: unknown }).runId === 'string'
      ? (second as { runId: string }).runId
      : undefined;

  if (secondRunId !== undefined && args.length <= 2) {
    const { runId: _runId, ...options } = second as { runId: string } & TOptions;
    return { runId: secondRunId, resumeData: first, options: options as unknown as TOptions };
  }

  if (typeof first === 'string') {
    return { runId: first, resumeData: second, options: (third ?? {}) as TOptions };
  }

  throw new Error('resumeGenerate requires a runId: call resumeGenerate(resumeData, { runId, ...options })');
}
