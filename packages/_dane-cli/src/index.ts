import { defineCommand, runMain } from 'citty';
import { config } from 'dotenv';
import { backportCommand } from './commands/backport.js';
import { getBotTokenCommand } from './commands/get-bot-token.js';
import { registryCommand } from './commands/registry.js';
import { snapshotCommand } from './commands/snapshot.js';

// Load .env.local first (higher priority), then .env
config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

const main = defineCommand({
  meta: {
    name: 'dane',
    description: 'Utilities for managing Mastra',
  },
  subCommands: {
    backport: backportCommand,
    'get-bot-token': getBotTokenCommand,
    registry: registryCommand,
    snapshot: snapshotCommand,
  },
});

void runMain(main);
