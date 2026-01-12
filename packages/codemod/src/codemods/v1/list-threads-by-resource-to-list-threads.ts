import type { API, FileInfo, Options } from 'jscodeshift';
import { createTransformer } from '../lib/create-transformer';
import { trackClassInstances } from '../lib/utils';

/**
 * Migrates from listThreadsByResourceId() to listThreads() with filter wrapping.
 * Only transforms calls on tracked Memory instances to avoid false positives.
 *
 * Before:
 * await memory.listThreadsByResourceId({
 *   resourceId: 'user-123',
 *   page: 0,
 *   perPage: 10
 * });
 *
 * After:
 * await memory.listThreads({
 *   filter: { resourceId: 'user-123' },
 *   page: 0,
 *   perPage: 10
 * });
 */
export default createTransformer((fileInfo: FileInfo, api: API, options: Options, context) => {
  const { j, root } = context;

  // Track Memory class instances
  const memoryInstances = trackClassInstances(j, root, 'Memory');

  // Also track variables assigned from methods that might return memory stores
  // e.g., const memoryStore = await storage.getStore('memory');
  const potentialMemoryStores = new Set<string>();

  root.find(j.VariableDeclarator).forEach(path => {
    if (path.value.id.type === 'Identifier') {
      const varName = path.value.id.name;
      const init = path.value.init;

      // Track variables with 'memory' or 'memoryStore' in the name as likely Memory instances
      if (varName.toLowerCase().includes('memory')) {
        // But NOT if it's an object literal (which would be our negative test case)
        if (init?.type !== 'ObjectExpression') {
          potentialMemoryStores.add(varName);
        }
      }
    }
  });

  // Combine both sets
  const allMemoryInstances = new Set([...memoryInstances, ...potentialMemoryStores]);

  // Early return if no instances found
  if (allMemoryInstances.size === 0) {
    return;
  }

  let changeCount = 0;

  // Find and transform listThreadsByResourceId() calls on tracked instances
  root
    .find(j.CallExpression, {
      callee: {
        type: 'MemberExpression',
        property: {
          type: 'Identifier',
          name: 'listThreadsByResourceId',
        },
      },
    })
    .forEach(path => {
      const { callee } = path.value;
      if (callee.type !== 'MemberExpression') return;
      if (callee.object.type !== 'Identifier') return;

      // Only process if called on a tracked instance
      if (!allMemoryInstances.has(callee.object.name)) return;

      const args = path.value.arguments;
      if (args.length !== 1 || args[0]?.type !== 'ObjectExpression') {
        return;
      }

      const objArg = args[0];
      const properties = objArg.properties;

      // Find the resourceId property
      let resourceIdProp: any = null;
      const otherProps: any[] = [];

      properties.forEach((prop: any) => {
        if (
          (prop.type === 'ObjectProperty' || prop.type === 'Property') &&
          prop.key?.type === 'Identifier' &&
          prop.key.name === 'resourceId'
        ) {
          resourceIdProp = prop;
        } else {
          otherProps.push(prop);
        }
      });

      if (!resourceIdProp || !resourceIdProp.value) {
        return;
      }

      // Create the new filter object
      const filterProp = j.property(
        'init',
        j.identifier('filter'),
        j.objectExpression([j.property('init', j.identifier('resourceId'), resourceIdProp.value as any)]),
      );

      // Update the method name
      if (path.value.callee.type === 'MemberExpression' && path.value.callee.property.type === 'Identifier') {
        path.value.callee.property.name = 'listThreads';
      }

      // Update the arguments with filter first, then other props
      path.value.arguments = [j.objectExpression([filterProp, ...otherProps])];

      changeCount++;
    });

  if (changeCount > 0) {
    context.hasChanges = true;
    context.messages.push(
      `Migrated ${changeCount} listThreadsByResourceId call(s) to listThreads with filter wrapping`,
    );
  }
});
