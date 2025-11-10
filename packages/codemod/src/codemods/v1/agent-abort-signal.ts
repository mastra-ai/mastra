import { createTransformer } from '../lib/create-transformer';

/**
 * Moves abortSignal from modelSettings to top-level options in agent method calls.
 *
 * ```ts
 * // Before:
 * agent.stream('prompt', {
 *   modelSettings: { abortSignal: signal }
 * })
 *
 * // After:
 * agent.stream('prompt', {
 *   modelSettings: {},
 *   abortSignal: signal
 * })
 * ```
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Track Agent instances
  const agentInstances = new Set<string>();

  root
    .find(j.NewExpression, {
      callee: {
        type: 'Identifier',
        name: 'Agent',
      },
    })
    .forEach(path => {
      const parent = path.parent.value;
      if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
        agentInstances.add(parent.id.name);
      }
    });

  // Find agent method calls (.stream, .generate, etc.)
  root
    .find(j.CallExpression)
    .filter(path => {
      const { callee } = path.value;
      if (callee.type !== 'MemberExpression') return false;
      if (callee.object.type !== 'Identifier') return false;

      // Only process if called on an Agent instance
      return agentInstances.has(callee.object.name);
    })
    .forEach(path => {
      const args = path.value.arguments;

      // We're looking for calls with an options object that has modelSettings
      if (args.length < 2) return;

      const optionsArg = args[1];
      if (!optionsArg || optionsArg.type !== 'ObjectExpression') return;
      if (!optionsArg.properties) return;

      // Find the modelSettings property
      let modelSettingsIndex = -1;
      const modelSettingsProp = optionsArg.properties.find((prop: any, index: number) => {
        if (
          (prop.type === 'Property' || prop.type === 'ObjectProperty') &&
          prop.key?.type === 'Identifier' &&
          prop.key.name === 'modelSettings' &&
          prop.value?.type === 'ObjectExpression'
        ) {
          modelSettingsIndex = index;
          return true;
        }
        return false;
      }) as any;

      if (!modelSettingsProp || modelSettingsProp.value?.type !== 'ObjectExpression') return;
      if (modelSettingsIndex === -1) return;

      const modelSettingsValue = modelSettingsProp.value as any;

      // Find abortSignal property inside modelSettings
      let abortSignalProp: any = null;
      const filteredProperties = modelSettingsValue.properties?.filter((prop: any) => {
        if (
          (prop.type === 'Property' || prop.type === 'ObjectProperty') &&
          prop.key?.type === 'Identifier' &&
          prop.key.name === 'abortSignal'
        ) {
          abortSignalProp = prop;
          return false; // Remove this property
        }
        return true; // Keep all other properties
      });

      if (!abortSignalProp) return;

      // Update modelSettings to not include abortSignal
      modelSettingsValue.properties = filteredProperties;

      // Rebuild the parent options properties with abortSignal right after modelSettings
      const newProperties: any[] = [];
      optionsArg.properties.forEach((prop: any, index: number) => {
        newProperties.push(prop);
        if (index === modelSettingsIndex) {
          newProperties.push(abortSignalProp);
        }
      });

      optionsArg.properties = newProperties as any;
      context.hasChanges = true;
    });

  if (context.hasChanges) {
    context.messages.push('Moved abortSignal from modelSettings to top-level options in agent method calls');
  }
});
