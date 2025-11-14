import { createTransformer } from '../lib/create-transformer';
import { trackClassInstances, renameMethod } from '../lib/utils';

/**
 * Renames workflow.createRunAsync() to workflow.createRun().
 * This simplifies the API by removing the redundant "Async" suffix.
 *
 * Before:
 * await workflow.createRunAsync({ input: { ... } });
 *
 * After:
 * await workflow.createRun({ input: { ... } });
 */
export default createTransformer((_fileInfo, _api, _options, context) => {
  const { j, root } = context;

  // Track Workflow instances and rename method in a single optimized pass
  const workflowInstances = trackClassInstances(j, root, 'Workflow');
  const count = renameMethod(j, root, workflowInstances, 'createRunAsync', 'createRun');

  if (count > 0) {
    context.hasChanges = true;
    context.messages.push('Renamed createRunAsync to createRun on Workflow instances');
  }
});
