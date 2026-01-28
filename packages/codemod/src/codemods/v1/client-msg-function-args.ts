import { createTransformer } from '../lib/create-transformer';
import { trackClassInstances, trackMethodCallResults, transformMethodCalls } from '../lib/utils';

/**
 * Transforms MastraClient agent method calls from object with `messages` property
 * to having `messages` as the first argument:
 *
 * Before:
 *   agent.generate({ messages: 'text', memory: {...} })
 *   agent.stream({ messages: [...], memory: {...} })
 *   agent.network({ messages: 'text', memory: {...} })
 *
 * After:
 *   agent.generate('text', { memory: {...} })
 *   agent.stream([...], { memory: {...} })
 *   agent.network('text', { memory: {...} })
 */
export default createTransformer((_fileInfo, _api, _options, context) => {
  const { j, root } = context;

  // Track MastraClient instances
  const clientInstances = trackClassInstances(j, root, 'MastraClient');
  if (clientInstances.size === 0) return;

  // Track agent instances obtained from mastraClient.getAgent()
  const agentInstances = trackMethodCallResults(j, root, clientInstances, 'getAgent');
  if (agentInstances.size === 0) return;

  // Methods to transform
  const methodsToTransform = new Set(['generate', 'stream', 'network']);

  // Transform method calls on agent instances
  transformMethodCalls(j, root, agentInstances, undefined, path => {
    const { callee, arguments: args } = path.value;

    // Filter to only the methods we want to transform
    if (callee.property.type !== 'Identifier') return;
    if (!methodsToTransform.has(callee.property.name)) return;

    // Check if it has exactly one argument that is an ObjectExpression
    if (args.length !== 1) return;
    const firstArg = args[0];
    if (!firstArg || firstArg.type !== 'ObjectExpression') return;

    // Find the `messages` property and collect other properties
    let messagesProperty: any = null;
    const otherProperties: any[] = [];

    firstArg.properties?.forEach((prop: any) => {
      if (
        (prop.type === 'Property' || prop.type === 'ObjectProperty') &&
        prop.key?.type === 'Identifier' &&
        prop.key.name === 'messages'
      ) {
        messagesProperty = prop;
      } else {
        otherProperties.push(prop);
      }
    });

    // If no messages property found, skip
    if (!messagesProperty) return;

    // Build new arguments: (messagesValue, { ...otherProperties })
    const newArgs: any[] = [messagesProperty.value];

    // Only add the second object argument if there are other properties
    if (otherProperties.length > 0) {
      newArgs.push(j.objectExpression(otherProperties));
    }

    // Replace arguments
    path.value.arguments = newArgs;
    context.hasChanges = true;
  });

  if (context.hasChanges) {
    context.messages.push('Transformed MastraClient agent method calls to use messages as first argument');
  }
});
