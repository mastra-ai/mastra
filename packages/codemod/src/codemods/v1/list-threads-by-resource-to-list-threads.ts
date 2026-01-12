import type { API, FileInfo, Options } from 'jscodeshift';
import { createTransformer } from '../lib/create-transformer';

/**
 * Migrates from listThreadsByResourceId() to listThreads() with filter wrapping.
 * The new listThreads API requires resourceId to be wrapped in a filter object.
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
  let changeCount = 0;

  // Find all .listThreadsByResourceId() calls
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
      const args = path.node.arguments;
      if (args.length !== 1 || args[0]?.type !== 'ObjectExpression') {
        return;
      }

      const objArg = args[0];
      const properties = objArg.properties;

      // Find the resourceId property
      let resourceIdProp: any = null;
      const otherProps: any[] = [];

      properties.forEach((prop: any) => {
        if (prop.type === 'ObjectProperty' && prop.key?.type === 'Identifier' && prop.key.name === 'resourceId') {
          resourceIdProp = prop;
        } else {
          otherProps.push(prop);
        }
      });

      if (!resourceIdProp || !resourceIdProp.value) {
        return;
      }

      // Create the new filter object
      const filterProp = j.objectProperty(
        j.identifier('filter'),
        j.objectExpression([j.objectProperty(j.identifier('resourceId'), resourceIdProp.value as any)]),
      );

      // Create new arguments with filter first, then other props
      const newProperties = [filterProp, ...otherProps];

      // Update the method name
      if (path.node.callee.type === 'MemberExpression' && path.node.callee.property.type === 'Identifier') {
        path.node.callee.property.name = 'listThreads';
      }

      // Update the arguments
      path.node.arguments = [j.objectExpression(newProperties)];

      changeCount++;
    });

  if (changeCount > 0) {
    context.hasChanges = true;
    context.messages.push(
      `Migrated ${changeCount} listThreadsByResourceId call(s) to listThreads with filter wrapping`,
    );
  }
});
