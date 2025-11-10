// @ts-nocheck

import { Mastra } from '@mastra/core';

const mastra = new Mastra();

const agents = mastra.listAgents();
const vectors = mastra.listVectors();
const workflows = mastra.listWorkflows();
const workflowsSerialized = mastra.listWorkflows({ serialized: true });
const scorers = mastra.listScorers();
const mcpServers = mastra.listMCPServers();
const logsByRunId = await mastra.listLogsByRunId({ runId: 'id', transportId: 'id' });
const logs = await mastra.listLogs('transportId');
const logsWithParams = await mastra.listLogs('transportId', { page: 1 });
