import { createTransformer } from '../lib/create-transformer';

/**
 * Renames Mastra plural API methods from get* to list*.
 * This provides a consistent naming convention across all plural APIs.
 *
 * Before:
 * const agents = mastra.getAgents();
 * const workflows = mastra.getWorkflows();
 * const logs = await mastra.getLogs('transportId');
 *
 * After:
 * const agents = mastra.listAgents();
 * const workflows = mastra.listWorkflows();
 * const logs = await mastra.listLogs('transportId');
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Map of old method names to new method names
  const methodRenames: Record<string, string> = {
    getAgents: 'listAgents',
    getVectors: 'listVectors',
    getWorkflows: 'listWorkflows',
    getScorers: 'listScorers',
    getMCPServers: 'listMCPServers',
    getLogsByRunId: 'listLogsByRunId',
    getLogs: 'listLogs',
  };

  // Track Mastra instances
  const mastraInstances = new Set<string>();

  // Find Mastra instances
  root
    .find(j.NewExpression, {
      callee: {
        type: 'Identifier',
        name: 'Mastra',
      },
    })
    .forEach(path => {
      const parent = path.parent.value;
      if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
        mastraInstances.add(parent.id.name);
      }
    });

  // Find and rename method calls on Mastra instances
  root
    .find(j.CallExpression)
    .filter(path => {
      const { callee } = path.value;
      if (callee.type !== 'MemberExpression') return false;
      if (callee.object.type !== 'Identifier') return false;
      if (callee.property.type !== 'Identifier') return false;

      // Only process if called on a Mastra instance
      if (!mastraInstances.has(callee.object.name)) return false;

      // Only process if it's one of the methods we want to rename
      return methodRenames.hasOwnProperty(callee.property.name);
    })
    .forEach(path => {
      const callee = path.value.callee;
      if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
        const oldName = callee.property.name;
        const newName = methodRenames[oldName];

        if (newName) {
          callee.property.name = newName;
          context.hasChanges = true;
        }
      }
    });

  if (context.hasChanges) {
    context.messages.push('Renamed Mastra plural API methods from get* to list*');
  }
});
