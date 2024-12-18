#! /usr/bin/env node
import dotenv from 'dotenv';

dotenv.config();

process.env.NODE_NO_WARNINGS = '1';

import { Command } from 'commander';

import { issueLabelerCommand } from './commands/issue-labeler.js';
import { message } from './commands/message.js';

const program = new Command();

program.command('chat').action(message);

program.command('issue-labeler').action(issueLabelerCommand);

program.parse(process.argv);
