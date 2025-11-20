import { createTransformer } from '../lib/create-transformer';
import { trackClassInstances, renameMethod } from '../lib/utils';

/**
 * Renames memory.query() to memory.recall().
 * This better describes the action of retrieving messages from memory.
 *
 * Before:
 * const result = await memory.query({ threadId: 'thread-123' });
 *
 * After:
 * const result = await memory.recall({ threadId: 'thread-123' });
 */
export default createTransformer((_fileInfo, _api, _options, context) => {
  const { j, root } = context;

  // Track Memory instances and rename query to recall in a single optimized pass
  const memoryInstances = trackClassInstances(j, root, 'Memory');
  const count = renameMethod(j, root, memoryInstances, 'query', 'recall');

  if (count > 0) {
    context.hasChanges = true;
    context.messages.push('Renamed query to recall on Memory instances');
  }
});
