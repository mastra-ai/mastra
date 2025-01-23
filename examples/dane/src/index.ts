#! /usr/bin/env node
import { Command } from 'commander';
import dotenv from 'dotenv';

import { changelog } from './commands/changelog.js';
import { commitMessageCommand } from './commands/commit-message.js';
import { configCommand } from './commands/config.js';
import { issueLabelerCommand } from './commands/issue-labeler.js';
import { linkChecker } from './commands/link-checker.js';
import { message } from './commands/message.js';
import { newContributorMessage } from './commands/new-contributor-message.js';
import { publishPackages } from './commands/publish-packages.js';
import { telephone } from './commands/telephone-game.js';

dotenv.config();

process.env.NODE_NO_WARNINGS = '1';

const program = new Command();

program.command('chat').action(message);

program
  .command('issue-labeler')
  .description('Automatically label GitHub issues based on their content and context')
  .action(issueLabelerCommand);

program
  .command('commit')
  .description('Create a sensible commit message based on the changes made')
  .action(commitMessageCommand);

program.addCommand(configCommand);

program.command('publish').description('Publish packages to the registry').action(publishPackages);

program.command('telephone-game').description('Play a classic game of telephone').action(telephone);

program.command('changelog').description('Mastra Changelog').action(changelog);

program.command('new-contributor').description('Create a new contributor message').action(newContributorMessage);

program
  .command('link-checker')
  .description('Check for broken links')
  .option('-u, --url <url>', 'URL to check')
  .action(args => {
    linkChecker({ url: args.url });
  });

program.parse(process.argv);
