import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { homedir, hostname } from 'node:os';
import path from 'node:path';

import { DEFAULT_CONFIG_DIR } from './constants.js';
import type { MastraCodeState } from './schema.js';

export const MACHINE_ID_FILE = 'machine-id';
const MACHINE_ID_PATTERN = /^[0-9a-f]{12}$/;

export interface LocalKnowledgeOrgOptions {
  /** Home directory the config dir lives under. Default: os.homedir() */
  homeDir?: string;
  /** Config directory name under the home directory. Default: '.mastracode' */
  configDirName?: string;
}

const machineIdCache = new Map<string, string>();

function readStoredMachineId(filePath: string): string | undefined {
  try {
    const stored = fs.readFileSync(filePath, 'utf-8').trim();
    return MACHINE_ID_PATTERN.test(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

const LOCK_WAIT_MS = 1_000;
const LOCK_STALE_MS = 5_000;
const LOCK_POLL_MS = 20;

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Run `fn` while holding an exclusive lock directory next to the machine-id
 * file. `mkdirSync` without `recursive` is atomic, so exactly one process at a
 * time reads, validates, and (re)writes the file; nothing is ever raced or
 * overwritten. A lock older than LOCK_STALE_MS is presumed abandoned (crashed
 * holder) and broken. Throws if the lock cannot be acquired in LOCK_WAIT_MS.
 */
function withMachineIdLock<T>(filePath: string, fn: () => T): T {
  const lockDir = `${filePath}.lock`;
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      fs.mkdirSync(lockDir);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      let stale = false;
      try {
        stale = Date.now() - fs.statSync(lockDir).mtimeMs > LOCK_STALE_MS;
      } catch {
        continue; // holder released between our mkdir and stat; retry immediately
      }
      if (stale) {
        fs.rmSync(lockDir, { recursive: true, force: true });
        continue;
      }
      if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${lockDir}`);
      sleepSync(LOCK_POLL_MS);
    }
  }
  try {
    return fn();
  } finally {
    fs.rmSync(lockDir, { recursive: true, force: true });
  }
}

/**
 * A durable, random identifier for this machine, persisted at
 * `<homeDir>/<configDirName>/machine-id` on first use so that the local
 * knowledge org survives hostname changes (as long as the config dir does).
 *
 * Creation and corrupt-file replacement happen under an exclusive lock (see
 * {@link withMachineIdLock}), so concurrent first runs converge on one id. If
 * the file can neither be read nor written, or the lock cannot be taken, this
 * falls back to a hash of the hostname without persisting or caching it, so a
 * read-only home never blocks curation and a later fix takes effect on the
 * next call.
 */
export function localMachineId(options: LocalKnowledgeOrgOptions = {}): string {
  const filePath = path.join(
    options.homeDir ?? homedir(),
    options.configDirName ?? DEFAULT_CONFIG_DIR,
    MACHINE_ID_FILE,
  );
  const cached = machineIdCache.get(filePath);
  if (cached) return cached;

  let id = readStoredMachineId(filePath);
  if (!id) {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      id = withMachineIdLock(filePath, () => {
        // Re-read under the lock: another process may have just created it.
        const existing = readStoredMachineId(filePath);
        if (existing) return existing;
        const fresh = randomBytes(6).toString('hex');
        fs.writeFileSync(filePath, `${fresh}\n`, 'utf-8');
        return fresh;
      });
    } catch {
      return createHash('sha256').update(hostname()).digest('hex').slice(0, 12);
    }
  }

  machineIdCache.set(filePath, id);
  return id;
}

/**
 * The organization rung local (TUI/studio) knowledge is curated under.
 *
 * Outside Factory nothing can tell us a real organization yet, so the org rung
 * defaults to the machine: org = this machine, resource = the project, thread =
 * the session. Keyed on the persisted {@link localMachineId} rather than the
 * hostname or checkout path: a hostname is mutable, and the session owner id
 * hashes the project path, which would make "org" mean "this checkout" and
 * org-level knowledge would never span projects. Resolving a real org id
 * (config, shared store, login) is future work; when it lands, it replaces this
 * default here.
 */
export function localKnowledgeOrgId(options: LocalKnowledgeOrgOptions = {}): string {
  return `mastracode-${localMachineId(options)}`;
}

export type KnowledgeScopeIdentity =
  | {
      resolved: true;
      organizationId: string;
      /** Set when the resource rung is anchored on something other than the session resource. */
      knowledgeResourceId?: string;
    }
  | { resolved: false; knowledgeResourceId?: string };

/**
 * The single source of truth for which org/resource rungs a session's knowledge
 * lives under. Every reader and writer of the knowledge store (the subconscious
 * memory factory, the /knowledge inspector) must derive its scope from here so
 * that what curation writes is what the browser reads.
 *
 * - Factory seeds the authoritative org id into session state. There is no
 *   fallback: a session owner is a USER id, never an organization, so a
 *   Factory-owned session without an org resolves to nothing (fail closed).
 * - Factory runs share one knowledge graph per project, so the resource rung is
 *   anchored on the project id.
 * - TUI/studio sessions default the org rung to this machine (see
 *   {@link localKnowledgeOrgId}).
 */
export function resolveKnowledgeScopeIdentity(
  state: MastraCodeState | undefined,
  options: LocalKnowledgeOrgOptions = {},
): KnowledgeScopeIdentity {
  const factoryProjectId = state?.factoryProjectId;
  const isFactory = typeof factoryProjectId === 'string' && factoryProjectId.trim().length > 0;
  const factoryOrgId = state?.factoryOrgId;
  const factoryOwned = isFactory || state?.factoryOrgUnresolved === true;

  // Trimmed to match what the Factory org seeder stores; not every seam routes
  // its seed through it.
  const organizationId = typeof factoryOrgId === 'string' ? factoryOrgId.trim() : '';
  if (organizationId) {
    return {
      resolved: true,
      organizationId,
      knowledgeResourceId: isFactory ? factoryProjectId : undefined,
    };
  }
  if (factoryOwned) {
    return { resolved: false, knowledgeResourceId: isFactory ? factoryProjectId : undefined };
  }
  return { resolved: true, organizationId: localKnowledgeOrgId(options) };
}
