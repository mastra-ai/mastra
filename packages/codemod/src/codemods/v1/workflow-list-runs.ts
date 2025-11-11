import { createTransformer } from '../lib/create-transformer';
import { trackClassInstances, renameMethod } from '../lib/utils';

/**
 * Renames workflow.getWorkflowRuns() to workflow.listWorkflowRuns().
 * This aligns with the convention that list* methods return collections.
 *
 * Before:
 * const runs = await workflow.getWorkflowRuns({ fromDate, toDate });
 *
 * After:
 * const runs = await workflow.listWorkflowRuns({ fromDate, toDate });
 */
export default createTransformer((_fileInfo, _api, _options, context) => {
  const { j, root } = context;

  // Track Workflow instances and rename method in a single optimized pass
  const workflowInstances = trackClassInstances(j, root, 'Workflow');
  const count = renameMethod(j, root, workflowInstances, 'getWorkflowRuns', 'listWorkflowRuns');

  if (count > 0) {
    context.hasChanges = true;
    context.messages.push('Renamed getWorkflowRuns to listWorkflowRuns on Workflow instances');
  }
});
