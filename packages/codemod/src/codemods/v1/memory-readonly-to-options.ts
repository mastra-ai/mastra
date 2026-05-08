import { createTransformer } from '../lib/create-transformer';

/**
 * Moves memory.readOnly to memory.options.readOnly in agent.stream() and agent.generate() calls.
 * The top-level readOnly property has been removed in favor of options.readOnly.
 *
 * Before:
 * agent.stream('Hello', {
 *   memory: {
 *     thread: threadId,
 *     resource: resourceId,
 *     readOnly: true,
 *   },
 * });
 *
 * After:
 * agent.stream('Hello', {
 *   memory: {
 *     thread: threadId,
 *     resource: resourceId,
 *     options: {
 *       readOnly: true,
 *     },
 *   },
 * });
 */
export default createTransformer((_fileInfo, _api, _options, context) => {
  const { j, root } = context;

  // Find all object expressions that have a 'memory' property
  root.find(j.ObjectExpression).forEach(path => {
    const memoryProp = path.value.properties.find(
      (prop: any) =>
        (prop.type === 'Property' || prop.type === 'ObjectProperty') &&
        prop.key &&
        prop.key.type === 'Identifier' &&
        prop.key.name === 'memory',
    ) as any;

    if (!memoryProp || !memoryProp.value || memoryProp.value.type !== 'ObjectExpression') {
      return;
    }

    const memoryObj = memoryProp.value;
    const properties = memoryObj.properties;

    // Find readOnly property
    const readOnlyPropIndex = properties.findIndex(
      (prop: any) =>
        (prop.type === 'Property' || prop.type === 'ObjectProperty') &&
        prop.key &&
        prop.key.type === 'Identifier' &&
        prop.key.name === 'readOnly',
    );

    if (readOnlyPropIndex === -1) {
      return;
    }

    const readOnlyProp = properties[readOnlyPropIndex] as any;
    const readOnlyValue = readOnlyProp.value;

    // Remove readOnly from top level
    properties.splice(readOnlyPropIndex, 1);

    // Find or create options property
    let optionsProp = properties.find(
      (prop: any) =>
        (prop.type === 'Property' || prop.type === 'ObjectProperty') &&
        prop.key &&
        prop.key.type === 'Identifier' &&
        prop.key.name === 'options',
    ) as any;

    if (optionsProp && optionsProp.value && optionsProp.value.type === 'ObjectExpression') {
      // Add readOnly to existing options
      optionsProp.value.properties.push(j.property('init', j.identifier('readOnly'), readOnlyValue));
    } else {
      // Create new options object with readOnly
      const newOptionsProp = j.property(
        'init',
        j.identifier('options'),
        j.objectExpression([j.property('init', j.identifier('readOnly'), readOnlyValue)]),
      );
      properties.push(newOptionsProp);
    }

    context.hasChanges = true;
  });

  if (context.hasChanges) {
    context.messages.push('Moved memory.readOnly to memory.options.readOnly');
  }
});
