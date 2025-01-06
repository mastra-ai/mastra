import { Mastra } from '@mastra/core';
import { PostgresEngine } from '@mastra/engine';
import { UpstashKVMemory } from '@mastra/memory';

import { dane, daneCommitMessage, daneIssueLabeler, danePackagePublisher } from './agents/index.js';
import { firecrawl } from './integrations/index.js';
import { deleteFileWorkflow } from './workflows/delete-file.js';
import { messageWorkflow, githubIssueLabeler, commitMessageGenerator } from './workflows/index.js';
import { packagePublisher } from './workflows/publish-packages.js';

const engine = new PostgresEngine({
  url: 'postgres://postgres:postgres@localhost:5433/mastra',
});

export const mastra = new Mastra({
  agents: {
    dane,
    danePackagePublisher,
    daneIssueLabeler,
    daneCommitMessage,
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
    packagePublisher: packagePublisher,
    deleteFile: deleteFileWorkflow,
  },
  logger: false,
  syncs: {
    ...firecrawl.getSyncs(),
  },
});
