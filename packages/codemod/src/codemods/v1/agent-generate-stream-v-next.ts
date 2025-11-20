import { createTransformer } from '../lib/create-transformer';
import { trackClassInstances, renameMethods } from '../lib/utils';

/**
 * Transforms Agent VNext methods to their standard names:
 * - agent.generateVNext() → agent.generate()
 * - agent.streamVNext() → agent.stream()
 *
 * Only transforms methods on variables that were instantiated with `new Agent(...)`
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Map of old method names to new method names
  const methodRenames: Record<string, string> = {
    generateVNext: 'generate',
    streamVNext: 'stream',
  };

  // Track Agent instances and rename methods efficiently
  const agentVariables = trackClassInstances(j, root, 'Agent');
  const renamed = renameMethods(j, root, agentVariables, methodRenames);

  if (renamed > 0) {
    context.hasChanges = true;
    context.messages.push(`Transformed Agent VNext methods: generateVNext/streamVNext → generate/stream`);
  }
});
