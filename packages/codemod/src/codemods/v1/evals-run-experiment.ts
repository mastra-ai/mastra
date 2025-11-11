import { createTransformer } from '../lib/create-transformer';
import { renameImportAndUsages } from '../lib/utils';

/**
 * Renames runExperiment to runEvals in imports and usages.
 * This provides clearer naming that better describes the evaluation functionality.
 *
 * Before:
 * import { runExperiment } from '@mastra/core/evals';
 * const result = await runExperiment({ target, scorers, data });
 *
 * After:
 * import { runEvals } from '@mastra/core/evals';
 * const result = await runEvals({ target, scorers, data });
 */
export default createTransformer((_fileInfo, _api, _options, context) => {
  const { j, root } = context;

  const count = renameImportAndUsages(j, root, '@mastra/core/evals', 'runExperiment', 'runEvals');

  if (count > 0) {
    context.hasChanges = true;
    context.messages.push('Renamed runExperiment to runEvals');
  }
});
