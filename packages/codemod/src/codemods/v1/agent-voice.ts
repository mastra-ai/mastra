import { createTransformer } from '../lib/create-transformer';

/**
 * Transforms Agent voice method calls to use agent.voice namespace.
 * - agent.speak(...) → agent.voice.speak(...)
 * - agent.listen() → agent.voice.listen()
 * - agent.getSpeakers() → agent.voice.getSpeakers()
 *
 * Only transforms methods on variables that were instantiated with `new Agent(...)`
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Voice methods that should be moved to agent.voice
  const voiceMethods = new Set(['speak', 'listen', 'getSpeakers']);

  // Track variable names that are Agent instances
  const agentVariables = new Set<string>();

  // Find all variable declarations with new Agent() assignments
  root.find(j.VariableDeclarator).forEach(path => {
    const node = path.node;

    // Check if the init is a new Agent() expression
    if (
      node.init &&
      node.init.type === 'NewExpression' &&
      node.init.callee.type === 'Identifier' &&
      node.init.callee.name === 'Agent' &&
      node.id.type === 'Identifier'
    ) {
      agentVariables.add(node.id.name);
    }
  });

  // Early return if no Agent instances found
  if (agentVariables.size === 0) return;

  // Find all call expressions that are agent voice methods
  root.find(j.CallExpression).forEach(path => {
    const node = path.node;

    // Check if callee is a member expression (e.g., agent.speak)
    if (node.callee.type !== 'MemberExpression') {
      return;
    }

    const callee = node.callee;

    // Check if the object is an Agent variable
    if (callee.object.type !== 'Identifier' || !agentVariables.has(callee.object.name)) {
      return;
    }

    // Check if the property is a voice method
    if (callee.property.type !== 'Identifier' || !voiceMethods.has(callee.property.name)) {
      return;
    }

    // Transform agent.method() to agent.voice.method()
    const newCallee = j.memberExpression(j.memberExpression(callee.object, j.identifier('voice')), callee.property);

    node.callee = newCallee;
    context.hasChanges = true;
  });

  if (context.hasChanges) {
    context.messages.push(`Transformed Agent voice methods to use agent.voice namespace`);
  }
});
