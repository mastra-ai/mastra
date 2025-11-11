import type {
  ObjectProperty,
  Property,
  ObjectExpression,
  SpreadElement,
  ObjectMethod,
  SpreadProperty,
} from 'jscodeshift';
import { createTransformer } from '../lib/create-transformer';
import { trackClassInstances } from '../lib/utils';

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
export default createTransformer((_fileInfo, _api, _options, context) => {
  const { j, root } = context;

  // Track Agent instances
  const agentInstances = trackClassInstances(j, root, 'Agent');

  // Early return if no instances found
  if (agentInstances.size === 0) return;

  // Single pass: Find and transform agent method calls
  root.find(j.CallExpression).forEach(path => {
    const { callee } = path.value;
    if (callee.type !== 'MemberExpression') return;
    if (callee.object.type !== 'Identifier') return;

    // Only process if called on an Agent instance
    if (!agentInstances.has(callee.object.name)) return;

    const args = path.value.arguments;

    // We're looking for calls with an options object that has modelSettings
    if (args.length < 2) return;

    const optionsArg = args[1];
    if (!optionsArg || optionsArg.type !== 'ObjectExpression') return;
    if (!optionsArg.properties) return;

    // Find the modelSettings property
    type ObjectProp = SpreadElement | Property | ObjectMethod | ObjectProperty | SpreadProperty;
    let modelSettingsIndex = -1;
    const modelSettingsProp = optionsArg.properties.find((prop, index) => {
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
    }) as Property | ObjectProperty | undefined;

    if (!modelSettingsProp || modelSettingsProp.value?.type !== 'ObjectExpression') return;
    if (modelSettingsIndex === -1) return;

    const modelSettingsValue = modelSettingsProp.value as ObjectExpression;

    // Find abortSignal property inside modelSettings
    let abortSignalProp: Property | ObjectProperty | undefined;
    const filteredProperties = modelSettingsValue.properties?.filter(prop => {
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
    const newProperties: ObjectProp[] = [];
    optionsArg.properties.forEach((prop, index) => {
      newProperties.push(prop);
      if (index === modelSettingsIndex) {
        newProperties.push(abortSignalProp!);
      }
    });

    optionsArg.properties = newProperties;
    context.hasChanges = true;
  });

  if (context.hasChanges) {
    context.messages.push('Moved abortSignal from modelSettings to top-level options in agent method calls');
  }
});
