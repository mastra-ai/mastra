import { createTransformer } from '../lib/create-transformer';

/**
 * Transforms voice property names in Agent configuration:
 * - speakProvider → output
 * - listenProvider → input
 * - realtimeProvider → realtime
 *
 * Only transforms properties within new Agent({ voice: { ... } })
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Map of old property names to new property names
  const propertyRenames: Record<string, string> = {
    speakProvider: 'output',
    listenProvider: 'input',
    realtimeProvider: 'realtime',
  };

  // Find all new Agent({ ... }) expressions
  root
    .find(j.NewExpression, {
      callee: { type: 'Identifier', name: 'Agent' },
    })
    .forEach(agentPath => {
      const configArg = agentPath.node.arguments[0];
      if (!configArg || configArg.type !== 'ObjectExpression') return;

      // Find the voice property in the Agent config object
      configArg.properties?.forEach((prop: any) => {
        if (
          (prop.type === 'Property' || prop.type === 'ObjectProperty') &&
          prop.key.type === 'Identifier' &&
          prop.key.name === 'voice' &&
          prop.value.type === 'ObjectExpression'
        ) {
          // Now rename properties within the voice object
          prop.value.properties?.forEach((voiceProp: any) => {
            if (
              (voiceProp.type === 'Property' || voiceProp.type === 'ObjectProperty') &&
              voiceProp.key.type === 'Identifier'
            ) {
              const oldName = voiceProp.key.name;
              const newName = propertyRenames[oldName];

              if (newName) {
                voiceProp.key.name = newName;
                context.hasChanges = true;
              }
            }
          });
        }
      });
    });

  if (context.hasChanges) {
    context.messages.push(
      `Transformed voice property names: speakProvider/listenProvider/realtimeProvider → output/input/realtime`,
    );
  }
});
