import { createTransformer } from '../lib/create-transformer';
import { trackClassInstances, renameMethods } from '../lib/utils';

/**
 * Transforms Agent processor methods:
 * - agent.getInputProcessors() → agent.listInputProcessors()
 * - agent.getOutputProcessors() → agent.listOutputProcessors()
 *
 * Only transforms methods on variables that were instantiated with `new Agent(...)`
 */
export default createTransformer((_fileInfo, _api, _options, context) => {
  const { j, root } = context;

  // Map of old method names to new method names
  const methodRenames: Record<string, string> = {
    getInputProcessors: 'listInputProcessors',
    getOutputProcessors: 'listOutputProcessors',
  };

  // Track Agent instances and rename methods in a single optimized pass
  const agentVariables = trackClassInstances(j, root, 'Agent');
  const count = renameMethods(j, root, agentVariables, methodRenames);

  if (count > 0) {
    context.hasChanges = true;
    context.messages.push(
      `Transformed Agent processor methods: getInputProcessors/getOutputProcessors → listInputProcessors/listOutputProcessors`,
    );
  }
});
