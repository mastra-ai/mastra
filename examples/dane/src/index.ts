#! /usr/bin/env node
import { Command } from 'commander';
import dotenv from 'dotenv';

import { commitMessageCommand } from './commands/commit-message.js';
import { configCommand } from './commands/config.js';
import { issueLabelerCommand } from './commands/issue-labeler.js';
import { message } from './commands/message.js';

dotenv.config();

process.env.NODE_NO_WARNINGS = '1';

const program = new Command();

program.command('chat').action(message);

program
  .command('issue-labeler')
  .description('Automatically label GitHub issues based on their content and context')
  .action(issueLabelerCommand);

program.command('commit').action(commitMessageCommand);

program.addCommand(configCommand);

program.parse(process.argv);
