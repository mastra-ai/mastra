import { createTransformer } from '../lib/create-transformer';
import { trackClassInstances, renameMethods } from '../lib/utils';

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
export default createTransformer((_fileInfo, _api, _options, context) => {
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

  // Track Mastra instances and rename all methods in a single optimized pass
  const mastraInstances = trackClassInstances(j, root, 'Mastra');
  const count = renameMethods(j, root, mastraInstances, methodRenames);

  if (count > 0) {
    context.hasChanges = true;
    context.messages.push('Renamed Mastra plural API methods from get* to list*');
  }
});
