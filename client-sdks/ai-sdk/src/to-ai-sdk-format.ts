/**
 * @deprecated Use `toAISdkStream` instead. This function has been renamed for clarity.
 *
 * @example
 * ```typescript
 * // Old (deprecated):
 * import { toAISdkFormat } from '@mastra/ai-sdk';
 * const stream = toAISdkFormat(agentStream, { from: 'agent' });
 *
 * // New:
 * import { toAISdkStream } from '@mastra/ai-sdk';
 * const stream = toAISdkStream(agentStream, { from: 'agent' });
 * ```
 */
export function toAISdkFormat(): never {
  throw new Error(
    'toAISdkFormat() has been deprecated. Please use toAISdkStream() instead.\n\n' +
      'Migration:\n' +
      '  import { toAISdkFormat } from "@mastra/ai-sdk";\n' +
      '  // Change to:\n' +
      '  import { toAISdkStream } from "@mastra/ai-sdk";\n\n' +
      'The function signature remains the same.',
  );
}
