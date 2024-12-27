#! /usr/bin/env node
import { Command } from 'commander';
import dotenv from 'dotenv';

import { issueLabelerCommand } from './commands/issue-labeler.js';
import { message } from './commands/message.js';

dotenv.config();

process.env.NODE_NO_WARNINGS = '1';

const program = new Command();

program.command('chat').action(message);

program.command('issue-labeler').action(issueLabelerCommand);

program.parse(process.argv);
