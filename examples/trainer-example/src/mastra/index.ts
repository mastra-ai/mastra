import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { Observability } from '@mastra/observability';

import { supportAgent } from './agents';
import { scorers } from './scorers';

// Resolve database path relative to this file's location
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '..', '..', 'mastra.db');

/**
 * Mastra instance configured for training example.
 *
 * Includes:
 * - Storage for persisting traces (required for training from traces)
 * - Observability enabled to capture and store agent traces
 * - Support agent with tools
 * - Scorers for evaluating agent responses
 */
export const mastra = new Mastra({
  storage: new LibSQLStore({
    id: 'trainer-example-storage',
    url: `file:${dbPath}`,
  }),
  // Enable observability to store traces for training
  observability: new Observability({
    default: { enabled: true },
  }),
  agents: { supportAgent },
  scorers,
});

export { supportAgent } from './agents';
export { scorers } from './scorers';
