import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/core/storage/libsql';

import { dane, daneChangeLog, daneCommitMessage, daneIssueLabeler, daneLinkChecker } from './agents/index.js';
import { daneNewContributor } from './agents/new-contributor.js';
import { danePackagePublisher } from './agents/package-publisher.js';
import { changelogWorkflow } from './workflows/changelog.js';
import { githubFirstContributorMessage } from './workflows/first-contributor.js';
import { messageWorkflow, githubIssueLabeler, commitMessageGenerator } from './workflows/index.js';
import { linkCheckerWorkflow } from './workflows/link-checker.js';
import { packagePublisher } from './workflows/publish-packages.js';
import { telephoneGameWorkflow } from './workflows/telephone-game.js';

export const mastra = new Mastra({
  agents: {
    dane,
    danePackagePublisher,
    daneLinkChecker,
    daneIssueLabeler,
    daneCommitMessage,
    daneChangeLog,
    daneNewContributor,
  },
  storage: new LibSQLStore({
    config: {
      url: ':memory:',
    },
  }),
  workflows: {
    message: messageWorkflow,
    githubIssueLabeler: githubIssueLabeler,
    commitMessage: commitMessageGenerator,
    packagePublisher: packagePublisher,
    telephoneGame: telephoneGameWorkflow,
    changelog: changelogWorkflow,
    githubFirstContributorMessage: githubFirstContributorMessage,
    linkChecker: linkCheckerWorkflow,
  },
});
