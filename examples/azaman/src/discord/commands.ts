import 'dotenv/config';
import { InstallGlobalCommands } from './utils.js';

// Simple test command
const TEST_COMMAND = {
  name: 'test',
  description: 'Basic command',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

const DOCS_COMMAND = {
  name: 'docs',
  description: 'Ask a question about the Mastra framework',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

const ALL_COMMANDS = [TEST_COMMAND, DOCS_COMMAND] as unknown as BodyInit;

InstallGlobalCommands(process.env.APP_ID!, ALL_COMMANDS);

