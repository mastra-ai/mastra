import { createTransformer } from '../lib/create-transformer';
import { trackClassInstances, transformMethodCalls } from '../lib/utils';

/**
 * Renames vectorMessageSearch parameter to vectorSearchString in memory.recall() calls.
 * This provides more consistent naming.
 *
 * Before:
 * memory.recall({
 *   threadId: 'thread-123',
 *   vectorMessageSearch: 'What did we discuss?',
 * });
 *
 * After:
 * memory.recall({
 *   threadId: 'thread-123',
 *   vectorSearchString: 'What did we discuss?',
 * });
 */
export default createTransformer((_fileInfo, _api, _options, context) => {
  const { j, root } = context;

  const memoryInstances = trackClassInstances(j, root, 'Memory');

  transformMethodCalls(j, root, memoryInstances, 'recall', path => {
    const args = path.value.arguments;
    const firstArg = args[0];
    if (!firstArg || firstArg.type !== 'ObjectExpression' || !firstArg.properties) return;

    firstArg.properties.forEach((prop: any) => {
      if (
        (prop.type === 'Property' || prop.type === 'ObjectProperty') &&
        prop.key &&
        prop.key.type === 'Identifier' &&
        prop.key.name === 'vectorMessageSearch'
      ) {
        prop.key.name = 'vectorSearchString';
        context.hasChanges = true;
      }
    });
  });

  if (context.hasChanges) {
    context.messages.push('Renamed vectorMessageSearch to vectorSearchString in memory.recall() calls');
  }
});
