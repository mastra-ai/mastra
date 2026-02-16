/**
 * Mastra Observational Memory extension for pi-coding-agent.
 *
 * Drop this file into .pi/extensions/ and OM will automatically:
 * - Compress long conversations into structured observations
 * - Inject observations into the system prompt
 * - Register `memory_status` and `memory_observations` tools
 *
 * Config is read from .pi/mastra.json (optional — defaults are sensible).
 */
import { createMastraOMExtension } from '@mastra/pi/extension';
import { LibSQLStore } from '@mastra/libsql';

const store = new LibSQLStore({ url: 'file:.pi/memory/observations.db' });
await store.init();
const storage = await store.getStore('memory');

const extension = createMastraOMExtension({ storage: storage! });

console.log('[mastra-om] Extension loaded — Observational Memory active');

export default extension;
