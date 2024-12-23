import { createLogger, Mastra } from '@mastra/core';
import { PostgresEngine } from '@mastra/engine';
import { UpstashKVMemory } from '@mastra/memory';

import { dane, daneIssueLabeler } from './agents/index.js';
import { firecrawl } from './integrations/index.js';
import { messageWorkflow, githubIssueLabeler, commitMessageGenerator } from './workflows/index.js';

const engine = new PostgresEngine({
  url: 'postgres://postgres:postgres@localhost:5433/mastra',
});

export const mastra = new Mastra({
  agents: {
    dane,
    daneIssueLabeler,
  },
  engine,
  memory: new UpstashKVMemory({
    url: 'http://localhost:8079',
    token: `example_token`,
    maxTokens: 39000,
  }),
  workflows: {
    message: messageWorkflow,
    githubIssueLabeler: githubIssueLabeler,
    commitMessage: commitMessageGenerator,
  },
  logger: createLogger({
    level: 'DEBUG',
    type: 'CONSOLE',
  }),
  syncs: {
    ...firecrawl.getSyncs(),
  },
});
