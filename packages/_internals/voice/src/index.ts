export * from './voice';
export type { RequestContext } from '@internal/core/request-context';
export type { ToolsInput } from '@internal/core/types';

type InferToolInput<TInputSchema> = TInputSchema extends { _input: infer TInput } ? TInput : unknown;

type VoiceToolExecute<TInputSchema, TContext, TOutput> = (
  input: InferToolInput<TInputSchema>,
  context: TContext,
) => TOutput | Promise<TOutput>;

export type VoiceTool<
  TId extends string = string,
  TInputSchema = unknown,
  TOutputSchema = unknown,
  TContext = unknown,
  TOutput = unknown,
> = {
  id: TId;
  description: string;
  inputSchema?: TInputSchema;
  outputSchema?: TOutputSchema;
  execute?: VoiceToolExecute<TInputSchema, TContext, TOutput>;
};

function getToolInput(input: unknown) {
  if (input && typeof input === 'object' && 'context' in input && Object.keys(input).length === 1) {
    return (input as { context: unknown }).context;
  }

  return input;
}

export function createTool<
  TId extends string,
  TInputSchema = unknown,
  TOutputSchema = unknown,
  TContext = unknown,
  TOutput = unknown,
>(
  opts: VoiceTool<TId, TInputSchema, TOutputSchema, TContext, TOutput>,
): VoiceTool<TId, TInputSchema, TOutputSchema, TContext, TOutput> {
  const execute = opts.execute;

  return {
    ...opts,
    execute: execute
      ? (input, context) => execute(getToolInput(input) as InferToolInput<TInputSchema>, context)
      : undefined,
  };
}
