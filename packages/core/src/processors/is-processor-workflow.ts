import type { ProcessorWorkflow } from './index';

/**
 * Type guard to check if an object is a Workflow that can be used as a processor.
 *
 * Extracted to its own module so that `runner.ts` (and by extension
 * `stream/base/output.ts`) can use it without loading the full processors
 * barrel — which re-exports every built-in processor, many of which import
 * from the agent barrel and create ESM init-time cycles.
 */
export function isProcessorWorkflow(obj: unknown): obj is ProcessorWorkflow {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'id' in obj &&
    typeof (obj as Record<string, unknown>).id === 'string' &&
    'inputSchema' in obj &&
    'outputSchema' in obj &&
    'execute' in obj &&
    typeof (obj as Record<string, unknown>).execute === 'function' &&
    !('processInput' in obj) &&
    !('processInputStep' in obj) &&
    !('processOutputStream' in obj) &&
    !('processOutputResult' in obj) &&
    !('processOutputStep' in obj) &&
    !('processToolResult' in obj) &&
    !('processLLMRequest' in obj) &&
    !('processAPIError' in obj)
  );
}
