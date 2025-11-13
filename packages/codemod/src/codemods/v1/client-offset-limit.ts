import { createTransformer } from '../lib/create-transformer';
import { trackClassInstances, transformObjectProperties } from '../lib/utils';

/**
 * Renames pagination properties from offset/limit to page/perPage.
 * This provides a more intuitive pagination model aligned with web pagination patterns.
 *
 * Before:
 * await client.listMemoryThreads({ offset: 0, limit: 20 });
 * await client.getTraces({ pagination: { offset: 0, limit: 40 } });
 *
 * After:
 * await client.listMemoryThreads({ page: 0, perPage: 20 });
 * await client.getTraces({ pagination: { page: 0, perPage: 40 } });
 */
export default createTransformer((_fileInfo, _api, _options, context) => {
  const { j, root } = context;

  // Map of old property names to new property names
  const propertyRenames: Record<string, string> = {
    offset: 'page',
    limit: 'perPage',
  };

  // Track MastraClient instances and objects returned from client methods in a single pass
  const clientInstances = trackClassInstances(j, root, 'MastraClient');
  const clientObjects = new Set<string>();

  // Early return if no client instances found
  if (clientInstances.size === 0) return;

  // Single pass: Find objects returned from client method calls AND transform properties
  root.find(j.CallExpression).forEach(path => {
    const { callee } = path.value;
    if (callee.type !== 'MemberExpression') return;
    if (callee.object.type !== 'Identifier') return;

    // Check if it's called on a MastraClient instance or tracked client object
    const isClientInstance = clientInstances.has(callee.object.name);
    const isClientObject = clientObjects.has(callee.object.name);

    if (isClientInstance) {
      // Track objects returned from client method calls
      const parent = path.parent.value;
      if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
        clientObjects.add(parent.id.name);
      }
    }

    if (isClientInstance || isClientObject) {
      // Transform offset/limit properties in the arguments of this call
      path.value.arguments.forEach(arg => {
        if (arg.type === 'ObjectExpression') {
          const count = transformObjectProperties(arg, propertyRenames);
          if (count > 0) {
            context.hasChanges = true;
          }
        }
      });
    }
  });

  if (context.hasChanges) {
    context.messages.push('Renamed pagination properties from offset/limit to page/perPage');
  }
});
