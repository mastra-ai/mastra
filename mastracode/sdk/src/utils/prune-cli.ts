/**
 * `mastracode prune` — storage maintenance from a non-interactive shell.
 *
 * The in-TUI `/prune` command has to stop the UI, quiesce background writers
 * (MCP, workers, intervals) and then exit the process, because retention
 * deletes and VACUUM need the database to themselves. A standalone process
 * already satisfies that contract — and, unlike `/prune`, it does not require a
 * rendered prompt first, so maintenance stays reachable when the TUI cannot
 * start. Without it a large mastra.db has no in-app remedy (issue #22056).
 *
 * Usage:
 *   mastracode prune                 delete rows older than the retention policies
 *   mastracode prune --vacuum        prune, then checkpoint WAL + VACUUM to return disk to the OS
 *   mastracode prune --keep-memory   prune, but keep chat history (messages/threads)
 */

import { LibSQLVector } from '@mastra/libsql';

import { DEFAULT_CONFIG_DIR } from '../constants.js';
import { loadSettings } from '../onboarding/settings.js';

import { detectProject, getStorageConfig } from './project.js';
import { createStorage, createVectorStore } from './storage-factory.js';
import {
  DEFAULT_RETENTION,
  createStorageMaintenance,
  resolveLocalDbFiles,
  runStorageMaintenance,
} from './storage-maintenance.js';

const USAGE = `Usage: mastracode prune [--vacuum] [--keep-memory]

  --vacuum        After pruning, compact the local database files so freed
                  pages are returned to the OS. Needs free disk for the copy.
  --keep-memory   Prune everything except chat history (messages/threads).
`;

/**
 * Run storage maintenance for the project in the current directory.
 * Returns the process exit code (0 on success).
 */
export async function runPruneCommand(args: string[]): Promise<number> {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    return 0;
  }

  const flags = new Set(args.map(a => a.toLowerCase()));
  const unknown = [...flags].filter(f => f !== '--vacuum' && f !== '--keep-memory');
  if (unknown.length > 0) {
    console.error(`Unknown prune option: ${unknown.join(', ')}\n${USAGE}`);
    return 1;
  }
  const vacuum = flags.has('--vacuum');
  const keepMemory = flags.has('--keep-memory');

  // Resolve storage exactly the way startup does, so prune targets the same
  // database the TUI uses — honoring MASTRA_DB_PATH / MASTRA_STORAGE_BACKEND,
  // global settings, and a project's own .mastracode/database.json.
  const settings = loadSettings();
  const project = detectProject(process.cwd());
  const storageConfig = getStorageConfig(project.rootPath, settings.storage, DEFAULT_CONFIG_DIR);

  const { storage, backend, warning } = await createStorage(storageConfig);
  if (warning) console.log(warning);

  // The vector store's connection must close alongside storage: the compaction
  // refuses to swap files while any connection is open.
  const vector = await createVectorStore(storageConfig, backend);

  try {
    // The libsql factory does not init (the PG path already has); init is
    // coalesced, so tables are guaranteed to exist before we delete from them.
    await storage.init();

    const localDbFiles = resolveLocalDbFiles(storageConfig, backend);
    if (localDbFiles.length > 0) {
      console.log(`Database: ${localDbFiles.join(', ')}`);
    }

    const maintenance = createStorageMaintenance({
      storage,
      backend,
      retention: DEFAULT_RETENTION,
      localDbFiles,
      ...(vector instanceof LibSQLVector ? { closeVector: () => vector.close() } : {}),
    });

    await runStorageMaintenance({ maintenance, vacuum, keepMemory, log: line => console.log(line) });
    console.log('Storage maintenance complete.');
    return 0;
  } catch (err) {
    console.error(`Storage maintenance failed: ${err instanceof Error ? err.message : String(err)}`);
    // runStorageMaintenance closes storage on its success path. If it threw
    // first, release the connections here so a retry isn't blocked by our own
    // open handles. Best effort — the original failure is what matters.
    try {
      await storage.close?.();
      if (vector instanceof LibSQLVector) await vector.close();
    } catch {
      // ignore cleanup errors
    }
    return 1;
  }
}
