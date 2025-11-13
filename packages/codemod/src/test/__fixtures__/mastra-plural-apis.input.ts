// @ts-nocheck

import { Mastra } from '@mastra/core';

const mastra = new Mastra();

const agents = mastra.getAgents();
const vectors = mastra.getVectors();
const workflows = mastra.getWorkflows();
const workflowsSerialized = mastra.getWorkflows({ serialized: true });
const scorers = mastra.getScorers();
const mcpServers = mastra.getMCPServers();
const logsByRunId = await mastra.getLogsByRunId({ runId: 'id', transportId: 'id' });
const logs = await mastra.getLogs('transportId');
const logsWithParams = await mastra.getLogs('transportId', { page: 1 });
