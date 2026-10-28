import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import type { Settings } from '../config/settings.js';

export function createMastra(settings: Settings) {
  const storage = new LibSQLStore({ id: 'security-scanner', url: settings.databaseUrl, disableInit: true });
  const mastra = new Mastra({ storage, agents: {}, workflows: {}, logger: false });
  return { mastra, storage };
}
