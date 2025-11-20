import { createTransformer } from '../lib/create-transformer';
import { renameImportAndUsages } from '../lib/utils';

/**
 * Renames toAISdkFormat to toAISdkStream in imports and usages.
 * This aligns the function name with its actual behavior.
 *
 * Before:
 * import { toAISdkFormat } from '@mastra/ai-sdk';
 * const stream = toAISdkFormat(agentStream);
 *
 * After:
 * import { toAISdkStream } from '@mastra/ai-sdk';
 * const stream = toAISdkStream(agentStream);
 */
export default createTransformer((_fileInfo, _api, _options, context) => {
  const { j, root } = context;

  const count = renameImportAndUsages(j, root, '@mastra/ai-sdk', 'toAISdkFormat', 'toAISdkStream');

  if (count > 0) {
    context.hasChanges = true;
    context.messages.push('Renamed toAISdkFormat to toAISdkStream');
  }
});
