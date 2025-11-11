import { createTransformer } from '../lib/create-transformer';

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
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Map of old property names to new property names
  const propertyRenames: Record<string, string> = {
    offset: 'page',
    limit: 'perPage',
  };

  // Track MastraClient instances and objects returned from client methods
  const clientInstances = new Set<string>();
  const clientObjects = new Set<string>();

  // First pass: Find MastraClient instances
  root
    .find(j.NewExpression, {
      callee: {
        type: 'Identifier',
        name: 'MastraClient',
      },
    })
    .forEach(path => {
      const parent = path.parent.value;
      if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
        clientInstances.add(parent.id.name);
      }
    });

  // Second pass: Find objects returned from client method calls
  root
    .find(j.CallExpression)
    .filter(path => {
      const { callee } = path.value;
      if (callee.type !== 'MemberExpression') return false;
      if (callee.object.type !== 'Identifier') return false;

      // Check if it's called on a MastraClient instance
      return clientInstances.has(callee.object.name);
    })
    .forEach(path => {
      const parent = path.parent.value;
      if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
        clientObjects.add(parent.id.name);
      }
    });

  // Third pass: Transform offset/limit in calls to client methods and client objects
  root
    .find(j.CallExpression)
    .filter(path => {
      const { callee } = path.value;
      if (callee.type !== 'MemberExpression') return false;
      if (callee.object.type !== 'Identifier') return false;

      // Check if it's called on a MastraClient instance or object returned from client
      return clientInstances.has(callee.object.name) || clientObjects.has(callee.object.name);
    })
    .forEach(path => {
      // Transform offset/limit properties in the arguments of this call
      path.value.arguments.forEach((arg: any) => {
        if (arg.type === 'ObjectExpression') {
          transformObjectProperties(arg);
        }
      });
    });

  // Helper function to transform properties recursively
  function transformObjectProperties(obj: any) {
    obj.properties?.forEach((prop: any) => {
      if ((prop.type === 'Property' || prop.type === 'ObjectProperty') && prop.key && prop.key.type === 'Identifier') {
        const oldName = prop.key.name;
        const newName = propertyRenames[oldName];

        if (newName) {
          prop.key.name = newName;
          context.hasChanges = true;
        }

        // Recursively transform nested objects
        if (prop.value && prop.value.type === 'ObjectExpression') {
          transformObjectProperties(prop.value);
        }
      }
    });
  }

  if (context.hasChanges) {
    context.messages.push('Renamed pagination properties from offset/limit to page/perPage');
  }
});
