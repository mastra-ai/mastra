import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

/**
 * A durable, random identifier for this machine, persisted at
 * `<homeDir>/<configDirName>/machine-id` on first use so that the local
 * knowledge org survives hostname changes, reimages, and container moves.
 *
 * Falls back to a hash of the hostname (without persisting) when the file can
 * neither be read nor written, so a read-only home never blocks curation.
 */
export function localMachineId(options: LocalKnowledgeOrgOptions = {}): string {
  const filePath = path.join(
    options.homeDir ?? homedir(),
    options.configDirName ?? DEFAULT_CONFIG_DIR,
    MACHINE_ID_FILE,
  );
  const cached = machineIdCache.get(filePath);
  if (cached) return cached;

  let id: string | undefined;
  try {
    if (existsSync(filePath)) {
      const stored = readFileSync(filePath, 'utf-8').trim();
      if (MACHINE_ID_PATTERN.test(stored)) id = stored;
    }
    if (!id) {
      id = randomBytes(6).toString('hex');
      mkdirSync(path.dirname(filePath), { recursive: true });
      writeFileSync(filePath, `${id}\n`, 'utf-8');
    }
  } catch {
    id = createHash('sha256').update(hostname()).digest('hex').slice(0, 12);
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
