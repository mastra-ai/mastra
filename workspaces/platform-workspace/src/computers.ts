import { createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Agent } from '@mastra/core/agent';
import type {
  Mastra,
  MastraComputerControl,
  MastraComputerControlResult,
  MastraComputers,
  MastraComputerScope,
  MastraComputerViewer,
} from '@mastra/core/mastra';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import type { ToolAction, ToolExecutionContext } from '@mastra/core/tools';
import type { SandboxComputer } from '@mastra/core/workspace';
import { z } from 'zod/v4';
import { COMPUTER_VIEWER_PORT } from './computer.js';
import { PlatformSandbox } from './sandbox.js';
import type { CaptureCheckpointResult, PlatformSandboxOptions, SandboxPortAuthCookie } from './sandbox.js';

export const NOT_ATTACHED = 'no computer attached — call computer_attach or computer_create';
export const NOT_FOUND = 'computer not found';
export const UNAVAILABLE = 'computer unavailable, try again';
export const DESTROY_FAILED = 'computer destroy failed';
export const MISSING_IDENTITY = 'missing thread or resource id';
/** @experimental */
export const HUMAN_HAS_CONTROL = 'the user has control of this computer; wait for them to hand it back';
const NOTE_MAX = 500;

// Ephemeral: cmp_e_<sandboxId>_<mac>. Persistent: cmp_p_<sandboxId>_<nonce>_<mac>; the nonce names the recovery key.
const ID_PATTERN = /^cmp_(?:(e)_([A-Za-z0-9-]{1,128})|(p)_([A-Za-z0-9-]{1,128})_([0-9a-f]{32}))_([A-Za-z0-9_-]{22})$/;
const SANDBOX_ID_PATTERN = /^[A-Za-z0-9-]{1,128}$/;
const MAC_VERSION = 'mastra-computer-v1';
const MAC_VERSION_PERSISTENT = 'mastra-computer-v2';
const RECOVERY_PREFIX = 'mastra-computer-';
const ATTACHMENT_TYPE = 'mastra-computer:';
const LIST_THREAD = 'mastra-computers:';
const LIST_TYPE = 'mastra-computers';

/** The part of a sandbox the computers toolset drives. */
export interface ComputerSandbox {
  readonly sandboxId: string | undefined;
  computer?: SandboxComputer;
  start(): Promise<unknown>;
  destroy(): Promise<void>;
  captureCheckpoint(): Promise<CaptureCheckpointResult>;
  /** Deletes the recovery checkpoint (persistent computers). */
  deleteCheckpoint?(): Promise<'deleted' | 'not_found' | 'skipped'>;
  executeCommand(
    command: string,
    args?: string[],
    options?: { timeout?: number },
  ): Promise<{ exitCode: number; stdout: string; stderr: string }>;
  getPortAuthCookie(port: number): Promise<SandboxPortAuthCookie | null>;
}

export interface PlatformComputersOptions {
  /** Platform environment the computers run in. Defaults to `MASTRA_ENVIRONMENT_ID`. */
  environmentId?: string;
  /** Defaults to `MASTRA_PLATFORM_ACCESS_TOKEN`. */
  accessToken?: string;
  /** Defaults to `MASTRA_PROJECT_ID`. */
  projectId?: string;
  /**
   * Signs computer ids so only the owning resource can attach or destroy them.
   * Defaults to `MASTRA_COMPUTERS_SECRET`, else a key derived from the access token —
   * rotating the token orphans persistent ids.
   */
  secret?: string;
  /** @internal Test seam for the sandbox driver. */
  createSandbox?: (options: PlatformSandboxOptions) => ComputerSandbox;
}

interface Entry {
  id: string;
  ready: Promise<ComputerSandbox>;
  sandbox?: ComputerSandbox;
  name: string;
  template: 'desktop';
  persistent: boolean;
  /** Platform recovery key of a persistent computer; its checkpoint is stored under it. */
  recoveryKey?: string;
  /** Reattach failed and the computer was rebuilt from its recovery key (disk = last checkpoint). */
  recovered?: boolean;
  ownerResourceId: string;
  queue: Promise<unknown>;
  destroyed: boolean;
  control: Lease;
}

interface AgentRef {
  agentId?: string;
  mastra?: Mastra;
}

/** Who drives the computer's input. Read and written synchronously only. */
interface Lease {
  holder: 'agent' | 'human';
  reason?: string;
  /** The thread (and its agent) to notify when the user hands control back. */
  target?: { resourceId: string; threadId: string } & AgentRef;
}

interface Scope {
  resourceId: string;
  threadId: string;
  key: string;
}

type Context = ToolExecutionContext<any, any, any>;

interface Verified {
  persistent: boolean;
  sandboxId: string;
  nonce?: string;
}

/** A persistent computer remembered for its owner resource. */
interface StoredComputer {
  id: string;
  name: string;
}

/** The slice of core's `threadState` storage domain the toolset persists through. */
interface StateStore {
  getState<T = unknown>(args: { threadId: string; type: string }): Promise<T | undefined>;
  setState<T = unknown>(args: { threadId: string; type: string; value: T }): Promise<void>;
  deleteState(args: { threadId: string; type: string }): Promise<void>;
}

class MemoryStateStore implements StateStore {
  readonly #values = new Map<string, unknown>();
  async getState<T>({ threadId, type }: { threadId: string; type: string }) {
    return this.#values.get(JSON.stringify([threadId, type])) as T | undefined;
  }
  async setState<T>({ threadId, type, value }: { threadId: string; type: string; value: T }) {
    this.#values.set(JSON.stringify([threadId, type]), value);
  }
  async deleteState({ threadId, type }: { threadId: string; type: string }) {
    this.#values.delete(JSON.stringify([threadId, type]));
  }
}

function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  return values.find(v => typeof v === 'string' && v.trim().length > 0);
}

function isReattachFailure(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 'SANDBOX_REATTACH_FAILED';
}

/**
 * Agent computers on the Mastra platform, exposed as a toolset. Register with
 * `new Mastra({ computers })` and give agents `{ ...computers.tools() }`.
 *
 * @experimental Requires `MASTRA_EXPERIMENTAL_COMPUTER=true`.
 */
export class PlatformComputers implements MastraComputers {
  readonly #key: Buffer;
  readonly #environmentId: string;
  readonly #sandboxOptions: PlatformSandboxOptions;
  readonly #createSandbox: (options: PlatformSandboxOptions) => ComputerSandbox;
  readonly #computers = new Map<string, Entry>();
  readonly #attachments = new Map<string, string>();
  readonly #lifecycle = new Map<string, Promise<unknown>>();
  /** Last agent seen per thread, so a user take can notify it. */
  readonly #agents = new Map<string, AgentRef>();
  /** Per-thread restore of a stored attachment, run once per process. */
  readonly #hydrated = new Map<string, Promise<void>>();
  /** Serializes read-modify-write of each resource's stored computer list (in this process). */
  readonly #listWrites = new Map<string, Promise<unknown>>();
  readonly #memoryStore = new MemoryStateStore();
  #mastra?: Mastra;
  #tools?: Record<string, ToolAction<any, any, any, any>>;

  constructor(options: PlatformComputersOptions = {}) {
    if (process.env.MASTRA_EXPERIMENTAL_COMPUTER !== 'true') {
      throw new Error('PlatformComputers is experimental; set MASTRA_EXPERIMENTAL_COMPUTER=true to enable it');
    }
    const secret = firstNonEmpty(options.secret, process.env.MASTRA_COMPUTERS_SECRET);
    const accessToken = firstNonEmpty(
      options.accessToken,
      process.env.MASTRA_PLATFORM_ACCESS_TOKEN,
      process.env.MASTRA_PLATFORM_SECRET_KEY,
    );
    if (secret) {
      this.#key = Buffer.from(secret, 'utf8');
    } else if (accessToken) {
      this.#key = Buffer.from(
        hkdfSync('sha256', Buffer.from(accessToken, 'utf8'), 'mastra-computers', 'mastra-computers-v1', 32),
      );
    } else {
      throw new Error('PlatformComputers needs a secret (set MASTRA_COMPUTERS_SECRET or an access token)');
    }
    this.#environmentId = options.environmentId ?? process.env.MASTRA_ENVIRONMENT_ID ?? '';
    this.#sandboxOptions = {
      ...(options.environmentId !== undefined && { environmentId: options.environmentId }),
      ...(options.accessToken !== undefined && { accessToken: options.accessToken }),
      ...(options.projectId !== undefined && { projectId: options.projectId }),
    };
    this.#createSandbox = options.createSandbox ?? (opts => new PlatformSandbox(opts) as unknown as ComputerSandbox);
  }

  #mac(flag: 'p' | 'e', sandboxId: string, ownerResourceId: string, nonce?: string): Buffer {
    const message = JSON.stringify(
      nonce === undefined
        ? [MAC_VERSION, flag, sandboxId, ownerResourceId, this.#environmentId]
        : [MAC_VERSION_PERSISTENT, flag, sandboxId, ownerResourceId, this.#environmentId, nonce],
    );
    return createHmac('sha256', this.#key).update(message, 'utf8').digest().subarray(0, 16);
  }

  /** @internal Persistent ids need the `nonce` that names their recovery key. */
  mintId(persistent: boolean, sandboxId: string, ownerResourceId: string, nonce?: string): string {
    const flag = persistent ? 'p' : 'e';
    const middle = persistent && nonce !== undefined ? `${sandboxId}_${nonce}` : sandboxId;
    const mac = this.#mac(flag, sandboxId, ownerResourceId, persistent ? nonce : undefined);
    return `cmp_${flag}_${middle}_${mac.toString('base64url')}`;
  }

  #verify(id: unknown, ownerResourceId: string): Verified | undefined {
    if (typeof id !== 'string') return undefined;
    const match = ID_PATTERN.exec(id);
    if (!match) return undefined;
    const persistent = match[3] === 'p';
    const sandboxId = (persistent ? match[4] : match[2])!;
    const nonce = persistent ? match[5] : undefined;
    const mac = match[6]!;
    const given = Buffer.from(mac, 'base64url');
    const expected = this.#mac(persistent ? 'p' : 'e', sandboxId, ownerResourceId, nonce);
    // 22 base64url chars carry 132 bits; reject non-canonical aliases of the same 16 bytes.
    if (given.length !== expected.length || given.toString('base64url') !== mac) return undefined;
    if (!timingSafeEqual(given, expected)) return undefined;
    return { persistent, sandboxId, ...(nonce !== undefined && { nonce }) };
  }

  /** @internal Called by `new Mastra({ computers })`. */
  __registerMastra(mastra: Mastra): void {
    this.#mastra = mastra;
  }

  /** Mastra's `threadState` storage when Mastra has storage, else this instance's memory. */
  async #store(): Promise<StateStore> {
    const storage = this.#mastra?.getStorage?.();
    const store = storage ? await storage.getStore('threadState').catch(() => undefined) : undefined;
    return (store as StateStore | undefined) ?? this.#memoryStore;
  }

  /** Runs a storage write; a storage failure is logged and never fails the tool call. */
  async #persist(what: string, fn: (store: StateStore) => Promise<unknown>): Promise<void> {
    try {
      await fn(await this.#store());
    } catch (error) {
      this.#mastra?.getLogger?.()?.warn(`computers: could not ${what}`, { error: String(error) });
    }
  }

  async #storedList(resourceId: string): Promise<StoredComputer[]> {
    try {
      const store = await this.#store();
      const value = await store.getState<unknown>({ threadId: LIST_THREAD + resourceId, type: LIST_TYPE });
      if (!Array.isArray(value)) return [];
      // Stored records are untrusted: keep only well-formed ids this resource could have minted.
      return value.filter(
        (r): r is StoredComputer =>
          typeof r?.id === 'string' &&
          typeof r?.name === 'string' &&
          this.#verify(r.id, resourceId)?.persistent === true,
      );
    } catch {
      return [];
    }
  }

  #updateList(resourceId: string, update: (list: StoredComputer[]) => StoredComputer[]): Promise<void> {
    const run = (this.#listWrites.get(resourceId) ?? Promise.resolve()).then(() =>
      this.#persist('update the computer list', async store => {
        const next = update(await this.#storedList(resourceId));
        await store.setState({ threadId: LIST_THREAD + resourceId, type: LIST_TYPE, value: next });
      }),
    );
    this.#listWrites.set(resourceId, run);
    void run.then(() => {
      if (this.#listWrites.get(resourceId) === run) this.#listWrites.delete(resourceId);
    });
    return run;
  }

  /** Writes (persistent) or clears (anything else) this thread's stored attachment. */
  #storeAttachment(scope: Scope, entry: Entry | undefined): Promise<void> {
    const key = { threadId: scope.threadId, type: ATTACHMENT_TYPE + scope.resourceId };
    return this.#persist('store the computer attachment', store =>
      entry?.persistent ? store.setState({ ...key, value: { computerId: entry.id } }) : store.deleteState(key),
    );
  }

  /** Restores this thread's stored attachment of a persistent computer. */
  async #hydrate(scope: Scope): Promise<void> {
    if (this.#attachments.has(scope.key)) return;
    const store = await this.#store();
    const key = { threadId: scope.threadId, type: ATTACHMENT_TYPE + scope.resourceId };
    const value = await store.getState<{ computerId?: unknown }>(key);
    if (!value) return;
    const id = value.computerId;
    const verified = this.#verify(id, scope.resourceId);
    const record = verified?.persistent ? (await this.#storedList(scope.resourceId)).find(r => r.id === id) : undefined;
    if (!verified || !record) {
      // Destroyed (or never valid): forget it.
      await store.deleteState(key).catch(() => {});
      return;
    }
    const entry = this.#lookup(record.id, verified, scope.resourceId, record);
    if (!entry) return;
    await entry.ready;
    if (!entry.destroyed && !this.#attachments.has(scope.key)) this.#attach(scope, entry);
  }

  /**
   * Resolves once this thread's stored attachment (if any) is restored, or
   * `undefined` when there is nothing to wait for. Created synchronously and
   * shared, so calls chained on it keep their call order.
   */
  #ensureHydrated(scope: Scope): Promise<void> | undefined {
    if (this.#attachments.has(scope.key)) return undefined;
    let pending = this.#hydrated.get(scope.key);
    if (!pending) {
      pending = this.#chain(scope, () => this.#hydrate(scope)).then(
        () => {},
        () => {
          // Retry on the next call.
          if (this.#hydrated.get(scope.key) === pending) this.#hydrated.delete(scope.key);
        },
      );
      this.#hydrated.set(scope.key, pending);
    }
    return pending;
  }

  #scope(context: Context): Scope | undefined {
    const rc = context?.requestContext;
    const resourceId = firstNonEmpty(context?.agent?.resourceId, rc?.get(MASTRA_RESOURCE_ID_KEY) as string | undefined);
    const threadId = firstNonEmpty(context?.agent?.threadId, rc?.get(MASTRA_THREAD_ID_KEY) as string | undefined);
    if (!resourceId || !threadId) return undefined;
    const key = JSON.stringify([resourceId, threadId]);
    const agentId = context?.agent?.agentId;
    const mastra = context?.mastra as Mastra | undefined;
    if (agentId && mastra) this.#agents.set(key, { agentId, mastra });
    return { resourceId, threadId, key };
  }

  #describe(entry: Entry, status: 'attached' | 'released' | 'available') {
    return {
      id: entry.id,
      name: entry.name,
      template: entry.template,
      status,
      persistent: entry.persistent,
      ...(entry.recovered && { recovered: true }),
    };
  }

  async #emit(context: Context, entry: Entry, threadId: string, status: 'attached' | 'released') {
    try {
      await context?.writer?.custom({
        type: 'data-computer',
        data: { computerId: entry.id, threadId, name: entry.name, status, persistent: entry.persistent },
      });
    } catch {
      // A closed stream must not turn a completed lifecycle change into a failed tool call.
    }
  }

  /** Serializes lifecycle calls per thread, in call order. Takes the slot synchronously. */
  #serial<T>(context: Context, fn: (scope: Scope) => Promise<T>): Promise<T | string> {
    const scope = this.#scope(context);
    if (!scope) return Promise.resolve(MISSING_IDENTITY);
    return this.#chain(scope, () => fn(scope));
  }

  #chain<T>(scope: Scope, fn: () => Promise<T>): Promise<T> {
    const run = (this.#lifecycle.get(scope.key) ?? Promise.resolve()).then(fn);
    const tail = run.catch(() => {});
    this.#lifecycle.set(scope.key, tail);
    void tail.then(() => {
      if (this.#lifecycle.get(scope.key) === tail) this.#lifecycle.delete(scope.key);
    });
    return run;
  }

  #attach(scope: Scope, entry: Entry) {
    this.#attachments.set(scope.key, entry.id);
  }

  /** Runs `fn` on the computer attached to this thread, in call order. Takes the slot synchronously. */
  #hands<T>(
    context: Context,
    fn: (sandbox: ComputerSandbox, computer: SandboxComputer, entry: Entry) => Promise<T>,
  ): Promise<T | string> {
    const scope = this.#scope(context);
    if (!scope) return Promise.resolve(MISSING_IDENTITY);
    const pending = this.#ensureHydrated(scope);
    return pending ? pending.then(() => this.#enqueue(scope, fn)) : this.#enqueue(scope, fn);
  }

  /** Synchronously takes the next slot on the attached computer's queue. */
  #enqueue<T>(
    scope: Scope,
    fn: (sandbox: ComputerSandbox, computer: SandboxComputer, entry: Entry) => Promise<T>,
  ): Promise<T | string> {
    const id = this.#attachments.get(scope.key);
    const entry = id ? this.#computers.get(id) : undefined;
    if (!entry || entry.ownerResourceId !== scope.resourceId) return Promise.resolve(NOT_ATTACHED);
    if (entry.control.holder === 'human') return Promise.resolve(HUMAN_HAS_CONTROL);
    // Re-checked when the action runs: a take while earlier actions are in flight refuses the rest.
    const run = entry.queue.then((): T | string | Promise<T> =>
      entry.control.holder === 'human' ? HUMAN_HAS_CONTROL : fn(entry.sandbox!, entry.sandbox!.computer!, entry),
    );
    entry.queue = run.catch(() => {});
    return run;
  }

  /**
   * Same-process entry, or a pending reattach of a persistent id stored before any await.
   * `record` (the owner's stored list entry) restores the name and allows recovery by
   * recovery key when the VM itself is gone.
   */
  #lookup(id: string, verified: Verified, ownerResourceId: string, record?: StoredComputer) {
    const existing = this.#computers.get(id);
    if (existing) return existing;
    if (!verified.persistent || !verified.nonce) return undefined;
    const recoveryKey = RECOVERY_PREFIX + verified.nonce;
    const entry: Entry = {
      id,
      ready: Promise.resolve(undefined as unknown as ComputerSandbox),
      name: record?.name ?? 'computer',
      template: 'desktop',
      persistent: true,
      recoveryKey,
      ownerResourceId,
      queue: Promise.resolve(),
      destroyed: false,
      control: { holder: 'agent' },
    };
    entry.ready = (async () => {
      const sandbox = this.#createSandbox({
        ...this.#sandboxOptions,
        id: recoveryKey,
        sandboxId: verified.sandboxId,
        computer: true,
        reattach: 'required',
      });
      try {
        await sandbox.start();
        return sandbox;
      } catch (error) {
        // Only a computer its owner still lists may be rebuilt; a destroyed one stays gone.
        if (!isReattachFailure(error) || !record) throw error;
      }
      // The VM is gone. The proxy hands back a live sandbox under the recovery key, or boots one
      // from the key's checkpoint.
      const recovered = this.#createSandbox({ ...this.#sandboxOptions, id: recoveryKey, computer: true });
      try {
        await recovered.start();
      } catch (error) {
        await recovered.destroy().catch(() => {});
        throw error;
      }
      entry.recovered = true;
      return recovered;
    })();
    entry.queue = entry.ready.catch(() => {});
    entry.ready.then(
      s => {
        entry.sandbox = s;
      },
      () => {
        if (this.#computers.get(id) === entry) this.#computers.delete(id);
      },
    );
    this.#computers.set(id, entry);
    return entry;
  }

  #create(input: { name?: string; persist?: boolean }, context: Context) {
    return this.#serial(context, async scope => {
      const persistent = input.persist === true;
      const nonce = persistent ? randomBytes(16).toString('hex') : undefined;
      const sandbox = this.#createSandbox({
        ...this.#sandboxOptions,
        ...(nonce !== undefined && { id: RECOVERY_PREFIX + nonce }),
        computer: true,
      });
      let entry: Entry | undefined;
      try {
        await sandbox.start();
        const sandboxId = sandbox.sandboxId;
        if (!sandboxId || !SANDBOX_ID_PATTERN.test(sandboxId)) throw new Error('unexpected sandbox id');
        entry = {
          id: this.mintId(persistent, sandboxId, scope.resourceId, nonce),
          ready: Promise.resolve(sandbox),
          sandbox,
          name: input.name?.trim() || 'computer',
          template: 'desktop',
          persistent,
          ...(nonce !== undefined && { recoveryKey: RECOVERY_PREFIX + nonce }),
          ownerResourceId: scope.resourceId,
          queue: Promise.resolve(),
          destroyed: false,
          control: { holder: 'agent' },
        };
      } catch {
        await sandbox.destroy().catch(() => {});
        return UNAVAILABLE;
      }
      this.#computers.set(entry.id, entry);
      this.#attach(scope, entry);
      if (persistent) {
        const stored = { id: entry.id, name: entry.name };
        await this.#updateList(scope.resourceId, list => [...list.filter(r => r.id !== stored.id), stored]);
      }
      await this.#storeAttachment(scope, entry);
      await this.#emit(context, entry, scope.threadId, 'attached');
      return { computer: this.#describe(entry, 'attached') };
    });
  }

  #attachTool(input: { id: string }, context: Context) {
    return this.#serial(context, async scope => {
      const verified = this.#verify(input.id, scope.resourceId);
      if (!verified) return NOT_FOUND;
      const record =
        verified.persistent && !this.#computers.has(input.id)
          ? (await this.#storedList(scope.resourceId)).find(r => r.id === input.id)
          : undefined;
      const entry = this.#lookup(input.id, verified, scope.resourceId, record);
      if (!entry || entry.destroyed) return NOT_FOUND;
      try {
        await entry.ready;
      } catch (error) {
        return isReattachFailure(error) ? NOT_FOUND : UNAVAILABLE;
      }
      if (entry.destroyed) return NOT_FOUND;
      this.#attach(scope, entry);
      await this.#storeAttachment(scope, entry);
      await this.#emit(context, entry, scope.threadId, 'attached');
      return { computer: this.#describe(entry, 'attached') };
    });
  }

  #release(context: Context) {
    const scope = this.#scope(context);
    if (!scope) return Promise.resolve(MISSING_IDENTITY);
    void this.#ensureHydrated(scope);
    return this.#chain(scope, async () => {
      const id = this.#attachments.get(scope.key);
      const entry = id ? this.#computers.get(id) : undefined;
      if (entry?.control.holder === 'human') return HUMAN_HAS_CONTROL;
      this.#attachments.delete(scope.key);
      await this.#storeAttachment(scope, undefined);
      if (!entry) return NOT_ATTACHED;
      if (entry.persistent && entry.sandbox) {
        // Checkpoint after the computer's queued actions, so a rebuilt machine has this disk.
        const sandbox = entry.sandbox;
        const capture = entry.queue.then(() => sandbox.captureCheckpoint());
        entry.queue = capture.catch(() => {});
        await capture.catch(() => {});
      }
      await this.#emit(context, entry, scope.threadId, 'released');
      return { computer: this.#describe(entry, 'released') };
    });
  }

  #destroy(input: { id: string }, context: Context) {
    return this.#serial(context, async scope => {
      const verified = this.#verify(input.id, scope.resourceId);
      if (!verified) return NOT_FOUND;
      const record =
        verified.persistent && !this.#computers.has(input.id)
          ? (await this.#storedList(scope.resourceId)).find(r => r.id === input.id)
          : undefined;
      const entry = this.#lookup(input.id, verified, scope.resourceId, record);
      if (!entry || entry.destroyed) return NOT_FOUND;
      if (entry.control.holder === 'human') return HUMAN_HAS_CONTROL;
      entry.destroyed = true;
      const releasedHere = this.#attachments.get(scope.key) === entry.id;
      for (const [key, id] of this.#attachments) if (id === entry.id) this.#attachments.delete(key);
      if (this.#computers.get(entry.id) === entry) this.#computers.delete(entry.id);
      // A persistent computer's checkpoint goes first: if that fails, its stored records stay and
      // a later destroy retries both.
      const done = entry.queue
        .then(() => entry.ready)
        .then(async sandbox => {
          if (entry.persistent) await sandbox.deleteCheckpoint?.();
          await sandbox.destroy();
        });
      entry.queue = done.catch(() => {});
      try {
        await done;
      } catch (error) {
        return isReattachFailure(error) ? NOT_FOUND : DESTROY_FAILED;
      }
      if (entry.persistent) {
        await this.#updateList(scope.resourceId, list => list.filter(r => r.id !== entry.id));
        if (releasedHere) await this.#storeAttachment(scope, undefined);
      }
      if (releasedHere) await this.#emit(context, entry, scope.threadId, 'released');
      return { destroyed: entry.id };
    });
  }

  async #requestHuman(input: { reason: string }, context: Context) {
    const scope = this.#scope(context);
    if (!scope) return MISSING_IDENTITY;
    await this.#ensureHydrated(scope);
    const id = this.#attachments.get(scope.key);
    const entry = id ? this.#computers.get(id) : undefined;
    if (!entry || entry.ownerResourceId !== scope.resourceId || !entry.sandbox || entry.destroyed) return NOT_ATTACHED;
    const reason = input.reason.trim();
    if (entry.control.holder !== 'human') {
      entry.control = {
        holder: 'human',
        reason,
        target: { resourceId: scope.resourceId, threadId: scope.threadId, ...this.#agents.get(scope.key) },
      };
    }
    const shown = entry.control.reason ?? reason;
    try {
      await context?.writer?.custom({
        type: 'data-computer',
        data: { computerId: entry.id, threadId: scope.threadId, control: 'human', reason: shown },
      });
    } catch {
      // A closed stream must not undo the handoff.
    }
    return {
      computerId: entry.id,
      reason: shown,
      control: 'human' as const,
      message: 'Stop using the computer and end your turn. You will be notified when the user hands it back.',
    };
  }

  async #list(context: Context) {
    const scope = this.#scope(context);
    if (!scope) return MISSING_IDENTITY;
    await this.#ensureHydrated(scope);
    const attachedId = this.#attachments.get(scope.key);
    const computers = [...this.#computers.values()]
      .filter(e => e.ownerResourceId === scope.resourceId && e.sandbox && !e.destroyed)
      .map(e => this.#describe(e, e.id === attachedId ? 'attached' : 'available'));
    // Persistent computers this process hasn't reattached yet.
    for (const record of await this.#storedList(scope.resourceId)) {
      if (this.#computers.has(record.id)) continue;
      computers.push({ id: record.id, name: record.name, template: 'desktop', status: 'available', persistent: true });
    }
    return { computers };
  }

  /** The computer toolset. Spread into an agent's `tools`. */
  tools(): Record<string, ToolAction<any, any, any, any>> {
    if (this.#tools) return this.#tools;
    const point = z.object({ x: z.number().int().min(0), y: z.number().int().min(0) });
    this.#tools = {
      computer_list: createTool({
        id: 'computer_list',
        description: 'List your computers.',
        inputSchema: z.object({}),
        execute: async (_input, context) => this.#list(context),
      }),
      computer_create: createTool({
        id: 'computer_create',
        description:
          'Create a desktop computer and attach it to this conversation. Set persist to keep it reattachable later by id.',
        inputSchema: z.object({
          template: z.literal('desktop').optional(),
          name: z.string().max(64).optional(),
          persist: z.boolean().optional(),
        }),
        execute: async (input, context) => this.#create(input, context),
      }),
      computer_attach: createTool({
        id: 'computer_attach',
        description: 'Attach an existing computer to this conversation by id.',
        inputSchema: z.object({ id: z.string().max(256) }),
        execute: async (input, context) => this.#attachTool(input, context),
      }),
      computer_release: createTool({
        id: 'computer_release',
        description: 'Detach the computer from this conversation without destroying it.',
        inputSchema: z.object({}),
        execute: async (_input, context) => this.#release(context),
      }),
      computer_request_human: createTool({
        id: 'computer_request_human',
        description:
          'Ask the user to take over the attached computer (e.g. to log in or solve a CAPTCHA). Your computer tools stop working until they hand it back; end your turn after calling this.',
        inputSchema: z.object({ reason: z.string().trim().min(1).max(NOTE_MAX) }),
        execute: async (input, context) => this.#requestHuman(input, context),
      }),
      computer_snapshot: createTool({
        id: 'computer_snapshot',
        description: "Save a checkpoint of the attached computer's state.",
        inputSchema: z.object({}),
        execute: async (_input, context) =>
          this.#hands(context, async sandbox => {
            const result = await sandbox.captureCheckpoint();
            return result.status === 'skipped'
              ? { status: result.status, reason: result.reason }
              : { status: result.status };
          }),
      }),
      computer_destroy: createTool({
        id: 'computer_destroy',
        description: 'Permanently destroy a computer by id.',
        inputSchema: z.object({ id: z.string().max(256) }),
        execute: async (input, context) => this.#destroy(input, context),
      }),
      computer_screenshot: createTool({
        id: 'computer_screenshot',
        description: 'Take a screenshot of the attached computer.',
        inputSchema: z.object({}),
        execute: async (_input, context) =>
          this.#hands(context, async (_s, computer) => {
            const shot = await computer.screenshot();
            return {
              __workspaceMedia: true as const,
              text: `Screenshot (${shot.data.byteLength} bytes)`,
              mediaType: shot.mediaType,
              data: Buffer.from(shot.data).toString('base64'),
            };
          }),
        toModelOutput: (output: unknown) => {
          const o = output as { __workspaceMedia?: boolean; text: string; data: string; mediaType: string };
          if (!o || typeof o !== 'object' || !o.__workspaceMedia) return undefined;
          return {
            type: 'content' as const,
            value: [
              { type: 'text' as const, text: o.text },
              { type: 'media' as const, data: o.data, mediaType: o.mediaType },
            ],
          };
        },
      }),
      computer_click: createTool({
        id: 'computer_click',
        description: 'Click at screen coordinates.',
        inputSchema: point.extend({ button: z.enum(['left', 'right']).optional(), double: z.boolean().optional() }),
        execute: async (input, context) =>
          this.#hands(context, async (_s, computer) => {
            if (input.double) await computer.doubleClick(input.x, input.y);
            else if (input.button === 'right') await computer.rightClick(input.x, input.y);
            else await computer.leftClick(input.x, input.y);
            return `clicked at (${input.x}, ${input.y})`;
          }),
      }),
      computer_move: createTool({
        id: 'computer_move',
        description: 'Move the mouse to screen coordinates.',
        inputSchema: point,
        execute: async (input, context) =>
          this.#hands(context, async (_s, computer) => {
            await computer.moveMouse(input.x, input.y);
            return `moved to (${input.x}, ${input.y})`;
          }),
      }),
      computer_drag: createTool({
        id: 'computer_drag',
        description: 'Drag with the left button from one point to another.',
        inputSchema: z.object({ from: point, to: point }),
        execute: async (input, context) =>
          this.#hands(context, async (_s, computer) => {
            await computer.drag(input.from, input.to);
            return 'dragged';
          }),
      }),
      computer_scroll: createTool({
        id: 'computer_scroll',
        description: 'Scroll the mouse wheel.',
        inputSchema: z.object({ direction: z.enum(['up', 'down']), amount: z.number().int().min(1).max(50) }),
        execute: async (input, context) =>
          this.#hands(context, async (_s, computer) => {
            await computer.scroll(input.direction, input.amount);
            return `scrolled ${input.direction}`;
          }),
      }),
      computer_type: createTool({
        id: 'computer_type',
        description: 'Type text at the keyboard focus.',
        inputSchema: z.object({ text: z.string() }),
        execute: async (input, context) =>
          this.#hands(context, async (_s, computer) => {
            await computer.type(input.text);
            return 'typed';
          }),
      }),
      computer_key: createTool({
        id: 'computer_key',
        description: "Press a key or chord, e.g. 'Enter' or 'ctrl+l'.",
        inputSchema: z.object({ keys: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]) }),
        execute: async (input, context) =>
          this.#hands(context, async (_s, computer) => {
            await computer.press(input.keys);
            return 'pressed';
          }),
      }),
      computer_screen_info: createTool({
        id: 'computer_screen_info',
        description: 'Get the screen size and cursor position.',
        inputSchema: z.object({}),
        execute: async (_input, context) =>
          this.#hands(context, async (_s, computer) => ({
            screen: await computer.getScreenSize(),
            cursor: await computer.getCursorPosition(),
          })),
      }),
      computer_exec: createTool({
        id: 'computer_exec',
        description: 'Run a shell command on the attached computer.',
        inputSchema: z.object({ command: z.string().min(1), timeout: z.number().int().min(1).max(600_000).optional() }),
        execute: async (input, context) =>
          this.#hands(context, async sandbox => {
            const r = await sandbox.executeCommand(input.command, undefined, {
              ...(input.timeout !== undefined && { timeout: input.timeout }),
            });
            return { exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr };
          }),
      }),
    };
    return this.#tools;
  }

  /**
   * Upstream viewer access for a server-side proxy. `headers` must never reach the browser.
   * Returns `null` when the computer isn't running; throws when it isn't attached to this thread.
   */
  async viewer(computerId: string, scope: MastraComputerScope): Promise<MastraComputerViewer | null> {
    const sandbox = (await this.#attached(computerId, scope)).sandbox!;
    const url = await sandbox.computer?.streamUrl?.();
    if (!url) return null;
    const cookie = await sandbox.getPortAuthCookie(COMPUTER_VIEWER_PORT);
    if (!cookie) return null;
    return { url, headers: { cookie: `${cookie.name}=${cookie.value}` } };
  }

  /** The computer attached to this thread, restoring a stored attachment first. Throws otherwise. */
  async #attached(computerId: string, scope: MastraComputerScope): Promise<Entry> {
    const key = JSON.stringify([scope.resourceId, scope.threadId]);
    await this.#ensureHydrated({ ...scope, key });
    const entry = this.#computers.get(computerId);
    if (this.#attachments.get(key) !== computerId || !entry?.sandbox || entry.ownerResourceId !== scope.resourceId) {
      throw new Error('computer not attached');
    }
    return entry;
  }

  /**
   * Who holds the computer's input. Throws when it isn't attached to this thread.
   *
   * @experimental
   */
  async controlState(computerId: string, scope: MastraComputerScope): Promise<MastraComputerControl> {
    const { control } = await this.#attached(computerId, scope);
    return { holder: control.holder, ...(control.reason !== undefined && { reason: control.reason }) };
  }

  /**
   * The user takes the computer's input (`take`) or hands it back to the agent (`release`).
   * The change applies immediately; an in-flight action finishes, later ones refuse.
   *
   * @experimental
   */
  async control(
    computerId: string,
    scope: MastraComputerScope,
    input: { action: 'take' | 'release'; note?: string },
  ): Promise<MastraComputerControlResult> {
    const entry = await this.#attached(computerId, scope);
    const note = input.note?.trim() || undefined;
    if (note && note.length > NOTE_MAX) throw new Error('note too long');
    const holder = input.action === 'take' ? 'human' : 'agent';
    if (entry.control.holder === holder) return { holder, notified: false, reason: 'no-change' };
    const key = JSON.stringify([scope.resourceId, scope.threadId]);
    const target =
      holder === 'human'
        ? { resourceId: scope.resourceId, threadId: scope.threadId, ...this.#agents.get(key) }
        : entry.control.target;
    entry.control =
      holder === 'human'
        ? { holder, reason: 'user took control', target }
        : { holder };
    return { holder, ...(await this.#notify(entry, holder, target, note)) };
  }

  /** Tells the agent on the lease's thread that control changed hands. Never throws. */
  async #notify(
    entry: Entry,
    holder: 'agent' | 'human',
    target: Lease['target'],
    note: string | undefined,
  ): Promise<Omit<MastraComputerControlResult, 'holder'>> {
    const mastra = target?.mastra;
    let agent: Agent | undefined;
    try {
      agent = target?.agentId && mastra ? mastra.getAgentById(target.agentId) : undefined;
    } catch {
      agent = undefined;
    }
    if (!agent || !target) return { notified: false, reason: 'no-agent' };
    const released = holder === 'agent';
    let reason: MastraComputerControlResult['reason'];
    try {
      const result = await agent.sendNotificationSignal(
        {
          source: 'computer',
          kind: released ? 'control-returned' : 'control-taken',
          // `urgent` delivers into an active run and wakes an idle one; `high` can be
          // summarized with a non-waking signal while the thread is active.
          priority: 'urgent',
          summary: released
            ? `The user handed control back${note ? `: ${note}` : ''}`
            : 'The user took control of the computer',
          attributes: { computerId: entry.id },
        },
        {
          resourceId: target.resourceId,
          threadId: target.threadId,
          ifIdle: {
            behavior: 'wake',
            streamOptions: { memory: { thread: target.threadId, resource: target.resourceId } },
          },
        },
      );
      const accepted = await result.accepted;
      if (accepted?.action === 'wake' || accepted?.action === 'deliver') return { notified: true };
      reason = 'not-delivered';
    } catch (error) {
      reason = String((error as Error)?.message).includes('notifications storage domain')
        ? 'no-notifications-storage'
        : 'error';
    }
    mastra?.getLogger?.()?.warn('computer control change was not delivered to the agent', {
      computer: entry.id.slice(0, 12),
      reason,
    });
    return { notified: false, reason };
  }
}
