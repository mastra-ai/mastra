import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { homedir } from 'node:os';
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

export type LocalMachineId = { ok: true; id: string } | { ok: false; reason: string };

function readStoredMachineId(filePath: string): LocalMachineId | undefined {
  let stored: string;
  try {
    stored = fs.readFileSync(filePath, 'utf-8').trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    return { ok: false, reason: `cannot read ${filePath}: ${(error as Error).message}` };
  }
  return MACHINE_ID_PATTERN.test(stored)
    ? { ok: true, id: stored }
    : { ok: false, reason: `${filePath} does not contain a valid machine id; fix or remove it` };
}

/**
 * A durable, random identifier for this machine, persisted at
 * `<homeDir>/<configDirName>/machine-id` on first use so that the local
 * knowledge org survives hostname changes (as long as the config dir does).
 *
 * The file is created with an exclusive open, so concurrent first runs
 * converge on one id: the loser re-reads what the winner wrote. There is no
 * fallback identity. If the file cannot be read, is corrupt, or cannot be
 * created, the result is `ok: false` and the caller refuses to curate or
 * inspect: knowledge written under a substitute org would be orphaned the
 * moment the real id resolves. Nothing is cached on failure, so a repaired
 * file takes effect on the next call. Never blocks or waits.
 */
export function localMachineId(options: LocalKnowledgeOrgOptions = {}): LocalMachineId {
  const filePath = path.join(
    options.homeDir ?? homedir(),
    options.configDirName ?? DEFAULT_CONFIG_DIR,
    MACHINE_ID_FILE,
  );
  const cached = machineIdCache.get(filePath);
  if (cached) return { ok: true, id: cached };

  let result = readStoredMachineId(filePath);
  if (!result) {
    const fresh = randomBytes(6).toString('hex');
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, `${fresh}\n`, { encoding: 'utf-8', flag: 'wx' });
      result = { ok: true, id: fresh };
    } catch (error) {
      result =
        (error as NodeJS.ErrnoException).code === 'EEXIST'
          ? // Lost the create race: adopt whatever the winner wrote.
            (readStoredMachineId(filePath) ?? {
              ok: false,
              reason: `${filePath} vanished after another process created it`,
            })
          : { ok: false, reason: `cannot create ${filePath}: ${(error as Error).message}` };
    }
  }

  if (result.ok) machineIdCache.set(filePath, result.id);
  return result;
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
 * default here. Throws when the machine id is unavailable; see
 * {@link resolveKnowledgeScopeIdentity} for the fail-closed form.
 */
export function localKnowledgeOrgId(options: LocalKnowledgeOrgOptions = {}): string {
  const machine = localMachineId(options);
  if (!machine.ok) throw new Error(`Local knowledge org unavailable: ${machine.reason}`);
  return `mastracode-${machine.id}`;
}

export type KnowledgeScopeIdentity =
  | {
      resolved: true;
      organizationId: string;
      /** Set when the resource rung is anchored on something other than the session resource. */
      knowledgeResourceId?: string;
    }
  | { resolved: false; knowledgeResourceId?: string; reason?: string };

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
  const local = localMachineId(options);
  return local.ok
    ? { resolved: true, organizationId: `mastracode-${local.id}` }
    : { resolved: false, reason: local.reason };
}
