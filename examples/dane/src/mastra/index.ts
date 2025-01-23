import { Mastra } from '@mastra/core';
import { PostgresEngine } from '@mastra/engine';
import { UpstashKVMemory } from '@mastra/memory';

import {
  dane,
  daneActionResolver,
  daneChangeLog,
  daneCommitMessage,
  daneIssueLabeler,
  daneLinkChecker,
  danePackagePublisher,
} from './agents/index.js';
import { firecrawl } from './integrations/index.js';
import { githubActionResolver } from './workflows/action-resolver.js';
import { changelogWorkflow } from './workflows/changelog.js';
import { messageWorkflow, githubIssueLabeler, commitMessageGenerator } from './workflows/index.js';
import { linkCheckerWorkflow } from './workflows/link-checker.js';
import { packagePublisher } from './workflows/publish-packages.js';
import { telephoneGameWorkflow } from './workflows/telephone-game.js';

const engine = new PostgresEngine({
  url: 'postgres://postgres:postgres@localhost:5433/mastra',
});

export const mastra = new Mastra({
  agents: {
    dane,
    danePackagePublisher,
    daneLinkChecker,
    daneIssueLabeler,
    daneActionResolver,
    daneCommitMessage,
    daneChangeLog,
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
    telephoneGame: telephoneGameWorkflow,
    changelog: changelogWorkflow,
    linkChecker: linkCheckerWorkflow,
    githubActionResolver: githubActionResolver,
  },
  syncs: {
    ...firecrawl.getSyncs(),
  },
});
