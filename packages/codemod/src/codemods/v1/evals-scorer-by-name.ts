import { createTransformer } from '../lib/create-transformer';
import { trackClassInstances, renameMethod } from '../lib/utils';

/**
 * Renames mastra.getScorerByName() to mastra.getScorerById().
 * This aligns with the broader API pattern of using 'id' for entity identification.
 *
 * Before:
 * const scorer = mastra.getScorerByName('helpfulness-scorer');
 *
 * After:
 * const scorer = mastra.getScorerById('helpfulness-scorer');
 */
export default createTransformer((_fileInfo, _api, _options, context) => {
  const { j, root } = context;

  // Track Mastra instances and rename method in a single optimized pass
  const mastraInstances = trackClassInstances(j, root, 'Mastra');
  const count = renameMethod(j, root, mastraInstances, 'getScorerByName', 'getScorerById');

  if (count > 0) {
    context.hasChanges = true;
    context.messages.push('Renamed getScorerByName to getScorerById on Mastra instances');
  }
});
