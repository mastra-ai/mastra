import { createTransformer } from '../lib/create-transformer';

/**
 * Transforms Mastra property access to method calls.
 * - mastra.logger → mastra.getLogger()
 * - mastra.storage → mastra.getStorage()
 * - mastra.agents → mastra.listAgents()
 * - mastra.tts → mastra.getTTS()
 * - mastra.vectors → mastra.getVectors()
 * - mastra.memory → mastra.getMemory()
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Map of property names to their corresponding method names
  const propertyToMethod: Record<string, string> = {
    logger: 'getLogger',
    storage: 'getStorage',
    agents: 'listAgents',
    tts: 'getTTS',
    vectors: 'getVectors',
    memory: 'getMemory',
  };

  // Find all member expressions where object is 'mastra' and property is one we want to transform
  root.find(j.MemberExpression).forEach(path => {
    const node = path.node;

    // Check if the object is an identifier named 'mastra'
    if (node.object.type !== 'Identifier' || node.object.name !== 'mastra') {
      return;
    }

    // Check if the property is one we want to transform
    if (node.property.type !== 'Identifier') {
      return;
    }

    const propertyName = node.property.name;
    const methodName = propertyToMethod[propertyName];

    if (!methodName) {
      return;
    }

    // Transform the member expression to a call expression
    const callExpression = j.callExpression(j.memberExpression(j.identifier('mastra'), j.identifier(methodName)), []);

    // Replace the member expression with the call expression
    j(path).replaceWith(callExpression);

    context.hasChanges = true;
  });

  if (context.hasChanges) {
    context.messages.push(`Transformed Mastra property access to method calls`);
  }
});
