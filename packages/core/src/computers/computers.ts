import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod/v4';
import type { Agent } from '../agent';
import type { Mastra } from '../mastra';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '../request-context';
import type { ComputersStorage, StoredComputerRecord, ThreadStateStorage } from '../storage';
import { createTool } from '../tools';
import type { ToolAction, ToolExecutionContext } from '../tools';
import { COMPUTER_ORDERED_TOOL_GROUP, markOrderedTool } from '../tools/ordered-tools';
import type { SandboxComputer, WorkspaceSandbox, WorkspaceSandboxResolver } from '../workspace';
import { WORKSPACE_TOOLS } from '../workspace/constants';
import type {
  ComputerActionInput,
  ComputerControlEnforcementResult,
  ComputerControlSubscriber,
  MastraComputerControl,
  MastraComputerControlResult,
  MastraComputers,
  MastraComputerScope,
  MastraComputerViewer,
} from './contracts.js';
import type { ComputerHandsExtension, ComputerHandsHost } from './hands-extension.js';

export const NOT_ATTACHED =
  'no computer attached — call mastra_workspace_computer_attach or mastra_workspace_computer_create';
export const NOT_FOUND = 'computer not found';
export const UNAVAILABLE = 'computer unavailable, try again';
export const DESTROY_FAILED = 'computer destroy failed';
export const MISSING_IDENTITY = 'missing thread or resource id';
/** @experimental */
export const HUMAN_HAS_CONTROL = 'the user has control of this computer; wait for them to hand it back';
export const CONTROL_NOT_ENFORCED = 'computer control change is still being enforced; try again';
const NOTE_MAX = 500;
const CONTROL_ENFORCEMENT_TIMEOUT_MS = 10_000;

const ID_PATTERN = /^cmp_([pe])_([A-Za-z0-9-]{1,128})_([A-Za-z0-9_-]{22})$/;
const PERSISTENT_ID_PATTERN = /^cmp_p2_([0-9a-f]{32})_([A-Za-z0-9_-]{22})$/;
const MAC_VERSION_PERSISTENT = 'mastra-computer-v2';
const ATTACHMENT_TYPE = 'mastra-computer';
const SANDBOX_ID_PATTERN = /^[A-Za-z0-9-]{1,128}$/;
const MAC_VERSION = 'mastra-computer-v1';
/** The provider-owned sandbox surface driven by the generic Computer engine. */
export interface ComputerSandbox {
  readonly sandboxId: string | undefined;
  computer?: SandboxComputer;
  start(): Promise<unknown>;
  destroy(): Promise<void>;
  captureCheckpoint(): Promise<{ status: string; reason?: string }>;
  executeCommand(
    command: string,
    args?: string[],
    options?: { timeout?: number },
  ): Promise<{ exitCode: number; stdout: string; stderr: string }>;
  networking?: { getPortUrl(port: number): Promise<string | null> };
}

/** Provider lifecycle and viewer boundary. Provider credentials never enter the engine or tool results. */
export interface ComputerProvider {
  readonly id: string;
  readonly macContext: string;
  create(options: { sandboxId?: string; reattach?: 'required' }): ComputerSandbox;
  viewer(sandbox: ComputerSandbox, scope: MastraComputerScope): Promise<MastraComputerViewer | null>;
  embed?(
    sandbox: ComputerSandbox,
    options: { origin: string; mode: 'watch' | 'control' },
  ): Promise<string | null>;
  port?(sandbox: ComputerSandbox, port: number): Promise<{ url: string; headers: Record<string, string> } | null>;
}

export interface ComputersOptions {
  provider: ComputerProvider;
  secret: string | Uint8Array;
  screenshotAfterAction?: boolean;
  handsExtension?: ComputerHandsExtension;
}

interface Entry {
  id: string;
  ready: Promise<ComputerSandbox>;
  sandbox?: ComputerSandbox;
  name: string;
  template: 'desktop';
  persistent: boolean;
  ownerResourceId: string;
  queue: Promise<unknown>;
  destroyed: boolean;
  control: Lease;
  extensionState: Map<string, unknown>;
}

interface AgentRef {
  agentId?: string;
  mastra?: Mastra;
}

/** Who drives the computer's input. Read and written synchronously only. */
interface Lease {
  holder: 'agent' | 'human';
  reason?: string;
  revision: number;
  enforcedRevision: number;
  /** The thread (and its agent) to notify when the user hands control back. */
  target?: { resourceId: string; threadId: string } & AgentRef;
}

interface SubscriberRegistration {
  subscriber: ComputerControlSubscriber;
  owners: Set<symbol>;
}

interface StoredAttachment {
  schemaVersion: 1;
  computerId: string;
  control: MastraComputerControl & { enforcedRevision: number };
}

interface Scope {
  resourceId: string;
  threadId: string;
  key: string;
}

type Context = ToolExecutionContext<any, any, any>;

function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  return values.find(v => typeof v === 'string' && v.trim().length > 0);
}

function isReattachFailure(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 'SANDBOX_REATTACH_FAILED';
}

function media(prefix: string, shot: { data: Uint8Array; mediaType: string }) {
  return {
    __workspaceMedia: true as const,
    text: `${prefix}Screenshot (${shot.data.byteLength} bytes)`,
    mediaType: shot.mediaType,
    data: Buffer.from(shot.data).toString('base64'),
  };
}


/**
 * Provider-neutral agent computers exposed as a toolset. Register with
 * `new Mastra({ computers })` and give agents `{ ...computers.tools() }`.
 *
 * @experimental Requires `MASTRA_EXPERIMENTAL_COMPUTER=true`.
 */
export class Computers implements MastraComputers {
  readonly #key: Buffer;
  readonly #provider: ComputerProvider;
  readonly #screenshotAfterAction: boolean;
  readonly #handsExtension?: ComputerHandsExtension;
  #mastra?: Mastra;
  readonly #computers = new Map<string, Entry>();
  readonly #lookups = new Map<string, Promise<Entry | undefined>>();
  readonly #attachments = new Map<string, string>();
  readonly #handsRecovery = new Map<string, Promise<void>>();
  readonly #lifecycle = new Map<string, Promise<unknown>>();
  /** Last agent seen per thread, so a user take can notify it. */
  readonly #agents = new Map<string, AgentRef>();
  readonly #controlSubscribers = new Map<string, SubscriberRegistration>();
  #tools?: Record<string, ToolAction<any, any, any, any>>;

  constructor(options: ComputersOptions) {
    if (process.env.MASTRA_EXPERIMENTAL_COMPUTER !== 'true') {
      throw new Error('Computers is experimental; set MASTRA_EXPERIMENTAL_COMPUTER=true to enable it');
    }
    if (typeof options.secret === 'string' && !options.secret.trim()) throw new Error('Computers needs a secret');
    if (typeof options.secret !== 'string' && options.secret.byteLength === 0) throw new Error('Computers needs a secret');
    this.#key = Buffer.from(options.secret);
    this.#provider = options.provider;
    this.#handsExtension = options.handsExtension;
    this.#screenshotAfterAction = options.screenshotAfterAction === true;
  }

  __registerMastra(mastra: Mastra): void {
    this.#mastra = mastra;
  }

  async #stores(): Promise<{ computers?: ComputersStorage; threadState?: ThreadStateStorage }> {
    const storage = this.#mastra?.getStorage();
    if (!storage) return {};
    return {
      computers: await storage.getStore('computers'),
      threadState: await storage.getStore('threadState'),
    };
  }

  async #persistAttachment(scope: Scope, entry: Entry): Promise<void> {
    if (!entry.persistent) return;
    const { computers, threadState } = await this.#stores();
    if (!computers || !threadState) throw new Error('persistent computers require computers and thread-state storage');
    const record = await computers.getComputer(entry.id);
    if (!record) throw new Error('persistent computer record not found');
    await computers.setComputer({
      ...record,
      control: {
        holder: entry.control.holder,
        ...(entry.control.reason ? { reason: entry.control.reason } : {}),
        revision: entry.control.revision,
        enforcedRevision: entry.control.enforcedRevision,
      },
    });
    const value: StoredAttachment = {
      schemaVersion: 1,
      computerId: entry.id,
      control: {
        holder: entry.control.holder,
        ...(entry.control.reason ? { reason: entry.control.reason } : {}),
        revision: entry.control.revision,
        enforcedRevision: entry.control.enforcedRevision,
      },
    };
    await threadState.setState({ threadId: scope.threadId, type: `${ATTACHMENT_TYPE}:${scope.resourceId}`, value });
  }

  async #deleteAttachment(scope: Scope): Promise<void> {
    const { threadState } = await this.#stores();
    await threadState?.deleteState({ threadId: scope.threadId, type: `${ATTACHMENT_TYPE}:${scope.resourceId}` });
  }

  registerControlSubscriber(subscriber: ComputerControlSubscriber): () => void {
    const owner = Symbol(subscriber.id);
    const existing = this.#controlSubscribers.get(subscriber.id);
    if (existing) {
      if (existing.subscriber.required !== subscriber.required || existing.subscriber.enforce !== subscriber.enforce) {
        throw new Error(`conflicting computer control subscriber: ${subscriber.id}`);
      }
      existing.owners.add(owner);
    } else {
      this.#controlSubscribers.set(subscriber.id, { subscriber, owners: new Set([owner]) });
    }
    return () => {
      const current = this.#controlSubscribers.get(subscriber.id);
      if (!current) return;
      current.owners.delete(owner);
      if (current.owners.size === 0) this.#controlSubscribers.delete(subscriber.id);
    };
  }

  async #enforce(entry: Entry, scope: MastraComputerScope, signal: AbortSignal): Promise<boolean> {
    const required = [...this.#controlSubscribers.values()].filter(registration => registration.subscriber.required);
    if (required.length === 0) {
      entry.control.enforcedRevision = entry.control.revision;
      return true;
    }
    const control = {
      holder: entry.control.holder,
      ...(entry.control.reason ? { reason: entry.control.reason } : {}),
      revision: entry.control.revision,
      enforced: entry.control.enforcedRevision >= entry.control.revision,
    } satisfies MastraComputerControl;
    const identity = { providerId: this.#provider.id, sandboxId: entry.sandbox?.sandboxId };
    const results = await Promise.all(
      required.map(async ({ subscriber }) => {
        let resolveAbort!: (result: ComputerControlEnforcementResult) => void;
        const aborted = new Promise<ComputerControlEnforcementResult>(resolve => {
          resolveAbort = resolve;
        });
        const abort = () => resolveAbort({ status: 'retryable', error: 'computer control enforcement timed out' });
        signal.addEventListener('abort', abort, { once: true });
        try {
          return await Promise.race([
            subscriber.enforce({ computerId: entry.id, scope, identity, control, signal }).catch(error => ({
              status: 'retryable' as const,
              error: String((error as Error)?.message ?? error),
            })),
            aborted,
          ]);
        } finally {
          signal.removeEventListener('abort', abort);
        }
      }),
    );
    const enforced = results.every(
      result => result.status === 'enforced' && result.enforcedRevision >= entry.control.revision,
    );
    if (enforced) entry.control.enforcedRevision = entry.control.revision;
    return enforced;
  }

  async #enforceWithinDeadline(entry: Entry, scope: MastraComputerScope): Promise<boolean> {
    const enforcement = new AbortController();
    const enforcementTimer = setTimeout(() => enforcement.abort(), CONTROL_ENFORCEMENT_TIMEOUT_MS);
    return this.#enforce(entry, scope, enforcement.signal).finally(() => clearTimeout(enforcementTimer));
  }

  #mac(flag: 'p' | 'e', sandboxId: string, ownerResourceId: string): Buffer {
    const message = JSON.stringify([MAC_VERSION, flag, sandboxId, ownerResourceId, this.#provider.macContext]);
    return createHmac('sha256', this.#key).update(message, 'utf8').digest().subarray(0, 16);
  }

  #persistentMac(recoveryId: string, ownerResourceId: string): Buffer {
    const message = JSON.stringify([MAC_VERSION_PERSISTENT, this.#provider.id, this.#provider.macContext, recoveryId, ownerResourceId]);
    return createHmac('sha256', this.#key).update(message, 'utf8').digest().subarray(0, 16);
  }

  #mintPersistentId(recoveryId: string, ownerResourceId: string): string {
    return `cmp_p2_${recoveryId}_${this.#persistentMac(recoveryId, ownerResourceId).toString('base64url')}`;
  }

  /** @internal */
  mintId(persistent: boolean, sandboxId: string, ownerResourceId: string): string {
    const flag = persistent ? 'p' : 'e';
    return `cmp_${flag}_${sandboxId}_${this.#mac(flag, sandboxId, ownerResourceId).toString('base64url')}`;
  }

  #verify(id: unknown, ownerResourceId: string): { persistent: boolean; sandboxId?: string; recoveryId?: string } | undefined {
    if (typeof id !== 'string') return undefined;
    const persistentMatch = PERSISTENT_ID_PATTERN.exec(id);
    if (persistentMatch) {
      const [, recoveryId, mac] = persistentMatch;
      const given = Buffer.from(mac!, 'base64url');
      const expected = this.#persistentMac(recoveryId!, ownerResourceId);
      if (given.length !== expected.length || given.toString('base64url') !== mac || !timingSafeEqual(given, expected)) return undefined;
      return { persistent: true, recoveryId };
    }
    const match = ID_PATTERN.exec(id);
    if (!match) return undefined;
    const [, flag, sandboxId, mac] = match as unknown as [string, 'p' | 'e', string, string];
    if (flag === 'p') return undefined;
    const given = Buffer.from(mac, 'base64url');
    const expected = this.#mac(flag, sandboxId, ownerResourceId);
    // 22 base64url chars carry 132 bits; reject non-canonical aliases of the same 16 bytes.
    if (given.length !== expected.length || given.toString('base64url') !== mac) return undefined;
    if (!timingSafeEqual(given, expected)) return undefined;
    return { persistent: false, sandboxId };
  }

  #scope(context: Context): Scope | undefined {
    const rc = context?.requestContext;
    const resourceId = firstNonEmpty(context?.agent?.resourceId, rc?.get(MASTRA_RESOURCE_ID_KEY) as string | undefined);
    const threadId = firstNonEmpty(context?.agent?.threadId, rc?.get(MASTRA_THREAD_ID_KEY) as string | undefined);
    if (!resourceId || !threadId) return undefined;
    const key = JSON.stringify([resourceId, threadId]);
    const agentId = context?.agent?.agentId;
    const mastra = (context?.mastra as Mastra | undefined) ?? this.#mastra;
    if (agentId && mastra) this.#agents.set(key, { agentId, mastra });
    return { resourceId, threadId, key };
  }

  #describe(entry: Entry, status: 'attached' | 'released' | 'available') {
    return { id: entry.id, name: entry.name, template: entry.template, status, persistent: entry.persistent };
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
    const run = (this.#lifecycle.get(scope.key) ?? Promise.resolve()).then(() => fn(scope));
    const tail = run.catch(() => {});
    this.#lifecycle.set(scope.key, tail);
    void tail.then(() => {
      if (this.#lifecycle.get(scope.key) === tail) this.#lifecycle.delete(scope.key);
    });
    return run;
  }

  #attach(scope: Scope, entry: Entry) {
    const previous = this.#attachments.get(scope.key);
    const old = previous !== undefined && previous !== entry.id ? this.#computers.get(previous) : undefined;
    if (old) this.#handsExtension?.release?.(old.id, scope.threadId);
    this.#attachments.set(scope.key, entry.id);
  }

  #controlRefusal(entry: Entry): string | undefined {
    if (entry.control.holder === 'human') return HUMAN_HAS_CONTROL;
    if (entry.control.enforcedRevision < entry.control.revision) return CONTROL_NOT_ENFORCED;
    return undefined;
  }

  #queueHands<T>(
    scope: Scope,
    entry: Entry | undefined,
    fn: (sandbox: ComputerSandbox, computer: SandboxComputer, entry: Entry) => Promise<T>,
  ): Promise<T | string> {
    const sandbox = entry?.sandbox;
    if (!entry || !sandbox || entry.ownerResourceId !== scope.resourceId) return Promise.resolve(NOT_ATTACHED);
    const refusal = this.#controlRefusal(entry);
    if (refusal) return Promise.resolve(refusal);
    // Re-checked when the action runs: a take while earlier actions are in flight refuses the rest.
    const run = entry.queue.then((): T | string | Promise<T> => {
      const queuedRefusal = this.#controlRefusal(entry);
      return queuedRefusal ?? fn(sandbox, sandbox.computer!, entry);
    });
    entry.queue = run.catch(() => {});
    return run;
  }

  /** Runs `fn` on the computer attached to this thread, in call order. */
  #hands<T>(context: Context, fn: (sandbox: ComputerSandbox, computer: SandboxComputer, entry: Entry) => Promise<T>) {
    const scope = this.#scope(context);
    if (!scope) return Promise.resolve(MISSING_IDENTITY);
    const currentId = this.#attachments.get(scope.key);
    const current = currentId ? this.#computers.get(currentId) : undefined;
    const pendingRecovery = this.#handsRecovery.get(scope.resourceId);
    if (current && !pendingRecovery) return this.#queueHands(scope, current, fn);
    if (current) return pendingRecovery!.then(() => this.#queueHands(scope, current, fn));

    const previousRecovery = pendingRecovery ?? Promise.resolve();
    let releaseRecovery!: () => void;
    const recovery = previousRecovery.then(() => new Promise<void>(resolve => (releaseRecovery = resolve)));
    this.#handsRecovery.set(scope.resourceId, recovery);
    return previousRecovery
      .then(async () => {
        try {
          const entry = await this.#attachedEntry(scope);
          const sandbox = entry?.sandbox ?? (await entry?.ready);
          if (entry && sandbox) entry.sandbox = sandbox;
          return this.#queueHands(scope, entry, fn);
        } finally {
          releaseRecovery();
        }
      })
      .finally(() => {
        if (this.#handsRecovery.get(scope.resourceId) === recovery) this.#handsRecovery.delete(scope.resourceId);
      });
  }

  /** A hand action, plus a screenshot in the same slot when `screenshotAfterAction` is on and the agent still holds control. */
  #act(context: Context, fn: (computer: SandboxComputer) => Promise<string>) {
    return this.#hands(context, async (_s, computer, entry) => {
      const text = await fn(computer);
      if (!this.#screenshotAfterAction || entry.control.holder === 'human') return text;
      // The action already happened; a failed screenshot must not make the model retry it.
      const shot = await computer.screenshot().catch(() => undefined);
      return shot ? media(`${text}. `, shot) : `${text} (screenshot failed)`;
    });
  }

  /** Same-process entry, or one shared pending reattach of a persistent id. */
  async #lookup(
    id: string,
    verified: { persistent: boolean; sandboxId?: string; recoveryId?: string },
    ownerResourceId: string,
  ): Promise<Entry | undefined> {
    const existing = this.#computers.get(id);
    if (existing) return existing;
    if (!verified.persistent) return undefined;
    const pending = this.#lookups.get(id);
    if (pending) return pending;

    const lookup = (async () => {
      let sandboxId = verified.sandboxId;
      let stored: StoredComputerRecord | undefined;
      if (verified.recoveryId) {
        const { computers } = await this.#stores();
        stored = await computers?.getComputer(id);
        if (!stored || stored.ownerResourceId !== ownerResourceId || stored.recoveryId !== verified.recoveryId) return undefined;
        sandboxId = (stored.providerIdentity as { sandboxId?: string } | undefined)?.sandboxId;
      }
      if (!sandboxId) return undefined;
      const sandbox = this.#provider.create({ sandboxId, reattach: 'required' });
      const entry: Entry = {
        id,
        ready: sandbox.start().then(() => sandbox),
        name: stored?.name ?? 'computer',
        template: 'desktop',
        persistent: true,
        ownerResourceId,
        queue: Promise.resolve(),
        destroyed: false,
        control: stored?.control
          ? {
              holder: stored.control.holder,
              ...(stored.control.reason ? { reason: stored.control.reason } : {}),
              revision: stored.control.revision,
              enforcedRevision: stored.control.enforcedRevision,
            }
          : { holder: 'agent', revision: 0, enforcedRevision: 0 },
        extensionState: new Map(),
      };
      entry.queue = entry.ready.catch(() => {});
      entry.ready.then(
        machine => {
          entry.sandbox = machine;
        },
        () => {
          if (this.#computers.get(id) === entry) this.#computers.delete(id);
        },
      );
      this.#computers.set(id, entry);
      return entry;
    })();
    this.#lookups.set(id, lookup);
    try {
      return await lookup;
    } finally {
      if (this.#lookups.get(id) === lookup) this.#lookups.delete(id);
    }
  }

  #create(input: { name?: string; persist?: boolean }, context: Context) {
    return this.#serial(context, async scope => {
      const persistent = input.persist === true;
      const stores = persistent ? await this.#stores() : {};
      if (persistent && (!stores.computers || !stores.threadState)) {
        return 'persistent computers require computers and thread-state storage';
      }
      const recoveryId = persistent ? randomBytes(16).toString('hex') : undefined;
      const sandbox = this.#provider.create({});
      let entry: Entry | undefined;
      try {
        await sandbox.start();
        const sandboxId = sandbox.sandboxId;
        if (!sandboxId || !SANDBOX_ID_PATTERN.test(sandboxId)) throw new Error('unexpected sandbox id');
        entry = {
          id: persistent ? this.#mintPersistentId(recoveryId!, scope.resourceId) : this.mintId(false, sandboxId, scope.resourceId),
          ready: Promise.resolve(sandbox),
          sandbox,
          name: input.name?.trim() || 'computer',
          template: 'desktop',
          persistent,
          ownerResourceId: scope.resourceId,
          queue: Promise.resolve(),
          destroyed: false,
          control: { holder: 'agent', revision: 0, enforcedRevision: 0 },
          extensionState: new Map(),
        };
      } catch {
        await sandbox.destroy().catch(() => {});
        return UNAVAILABLE;
      }
      if (persistent) {
        const record: StoredComputerRecord = {
          schemaVersion: 1,
          id: entry.id,
          recoveryId: recoveryId!,
          providerId: this.#provider.id,
          providerIdentity: { sandboxId: entry.sandbox!.sandboxId },
          ownerResourceId: scope.resourceId,
          name: entry.name,
          template: 'desktop',
          control: { holder: 'agent', revision: 0, enforcedRevision: 0 },
          createdAt: Date.now(),
        };
        try {
          await stores.computers!.setComputer(record);
        } catch (error) {
          await sandbox.destroy().catch(() => {});
          throw error;
        }
      }
      try {
        await this.#persistAttachment(scope, entry);
      } catch (error) {
        if (persistent) await stores.computers!.deleteComputer(entry.id).catch(() => {});
        await sandbox.destroy().catch(() => {});
        throw error;
      }
      // Durable commit point: persist, publish locally, release previous hands, then emit.
      this.#computers.set(entry.id, entry);
      this.#attach(scope, entry);
      await this.#emit(context, entry, scope.threadId, 'attached');
      return { computer: this.#describe(entry, 'attached') };
    });
  }

  #attachTool(input: { id: string }, context: Context) {
    return this.#serial(context, async scope => {
      const verified = this.#verify(input.id, scope.resourceId);
      if (!verified) return NOT_FOUND;
      const entry = await this.#lookup(input.id, verified, scope.resourceId);
      if (!entry || entry.destroyed) return NOT_FOUND;
      try {
        await entry.ready;
      } catch (error) {
        return isReattachFailure(error) ? NOT_FOUND : UNAVAILABLE;
      }
      if (entry.destroyed) return NOT_FOUND;
      const previousId = this.#attachments.get(scope.key);
      const previous = previousId ? this.#computers.get(previousId) : undefined;
      await this.#persistAttachment(scope, entry);
      if (entry.destroyed) {
        if (previous) await this.#persistAttachment(scope, previous);
        else await this.#deleteAttachment(scope);
        return NOT_FOUND;
      }
      // Durable commit point: persist, publish locally, release previous hands, then emit.
      this.#attach(scope, entry);
      await this.#emit(context, entry, scope.threadId, 'attached');
      return { computer: this.#describe(entry, 'attached') };
    });
  }

  #release(context: Context) {
    return this.#serial(context, async scope => {
      const id = this.#attachments.get(scope.key);
      const entry = id ? this.#computers.get(id) : undefined;
      if (entry?.control.holder === 'human') return HUMAN_HAS_CONTROL;
      this.#attachments.delete(scope.key);
      await this.#deleteAttachment(scope);
      if (!entry) return NOT_ATTACHED;
      this.#handsExtension?.release?.(entry.id, scope.threadId);
      await this.#emit(context, entry, scope.threadId, 'released');
      return { computer: this.#describe(entry, 'released') };
    });
  }

  #destroy(input: { id: string }, context: Context) {
    return this.#serial(context, async scope => {
      const verified = this.#verify(input.id, scope.resourceId);
      if (!verified) return NOT_FOUND;
      const entry = await this.#lookup(input.id, verified, scope.resourceId);
      if (!entry || entry.destroyed) return NOT_FOUND;
      if (entry.control.holder === 'human') return HUMAN_HAS_CONTROL;
      entry.destroyed = true;
      this.#handsExtension?.destroy?.(entry.id);
      const releasedHere = this.#attachments.get(scope.key) === entry.id;
      for (const [key, id] of this.#attachments) if (id === entry.id) this.#attachments.delete(key);
      if (this.#computers.get(entry.id) === entry) this.#computers.delete(entry.id);
      const done = entry.queue.then(() => entry.ready).then(sandbox => sandbox.destroy());
      entry.queue = done.catch(() => {});
      try {
        await done;
      } catch (error) {
        return isReattachFailure(error) ? NOT_FOUND : DESTROY_FAILED;
      }
      if (entry.persistent) {
        const { computers } = await this.#stores();
        await computers?.deleteComputer(entry.id);
      }
      if (releasedHere) {
        await this.#deleteAttachment(scope);
        await this.#emit(context, entry, scope.threadId, 'released');
      }
      return { destroyed: entry.id };
    });
  }

  async #requestHuman(input: { reason: string }, context: Context) {
    const scope = this.#scope(context);
    if (!scope) return MISSING_IDENTITY;
    const entry = await this.#attachedEntry(scope);
    const sandbox = entry?.sandbox ?? (await entry?.ready);
    if (!entry || !sandbox || entry.ownerResourceId !== scope.resourceId || entry.destroyed) return NOT_ATTACHED;
    const reason = input.reason.trim();
    const run = entry.queue.then(async () => {
      let enforced = entry.control.enforcedRevision >= entry.control.revision;
      if (entry.control.holder !== 'human') {
        entry.control = {
          holder: 'human',
          reason,
          revision: entry.control.revision + 1,
          enforcedRevision: entry.control.enforcedRevision,
          target: { resourceId: scope.resourceId, threadId: scope.threadId, ...this.#agents.get(scope.key) },
        };
        enforced = await this.#enforceWithinDeadline(entry, scope);
        await this.#persistAttachment(scope, entry);
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
        revision: entry.control.revision,
        control: 'human' as const,
        enforced,
        message: 'Stop using the computer and end your turn. You will be notified when the user hands it back.',
      };
    });
    entry.queue = run.catch(() => {});
    return run;
  }

  async #list(context: Context) {
    const scope = this.#scope(context);
    if (!scope) return MISSING_IDENTITY;
    const attached = await this.#attachedEntry(scope);
    const computersById = new Map(
      [...this.#computers.values()]
        .filter(entry => entry.ownerResourceId === scope.resourceId && entry.sandbox && !entry.destroyed)
        .map(entry => [entry.id, this.#describe(entry, entry.id === attached?.id ? 'attached' : 'available')]),
    );
    const { computers: store } = await this.#stores();
    for (const record of (await store?.listComputers(scope.resourceId)) ?? []) {
      if (!computersById.has(record.id)) {
        computersById.set(record.id, {
          id: record.id,
          name: record.name,
          template: record.template,
          status: record.id === attached?.id ? 'attached' : 'available',
          persistent: true,
        });
      }
    }
    return { computers: [...computersById.values()] };
  }

  #handsHost(): ComputerHandsHost {
    return {
      run: async (context, fn) =>
        this.#hands(context as Context, async (sandbox, computer, entry) => {
          const scope = this.#scope(context as Context);
          if (!scope) return MISSING_IDENTITY;
          return fn({
            computerId: entry.id,
            sandbox,
            computer,
            resourceId: scope.resourceId,
            threadId: scope.threadId,
            state: entry.extensionState,
            runInput: task => task(),
            port: port => this.#provider.port?.(sandbox, port) ?? Promise.resolve(null),
            signal: (kind, summary, attributes) => this.#signalExtension(scope, entry, kind, summary, attributes),
          });
        }),
      act: (context, fn) => this.#act(context as Context, fn as (computer: SandboxComputer) => Promise<string>) as any,
    };
  }

  async #signalExtension(
    scope: Scope,
    entry: Entry,
    kind: string,
    summary: string,
    attributes: Record<string, string> = {},
  ): Promise<void> {
    if (entry.control.holder === 'human') return;
    const target = { resourceId: scope.resourceId, threadId: scope.threadId, ...this.#agents.get(scope.key) };
    let agent: Agent | undefined;
    try {
      agent = target.agentId && target.mastra ? target.mastra.getAgentById(target.agentId) : undefined;
    } catch {
      agent = undefined;
    }
    if (!agent) return;
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, target.resourceId);
    requestContext.set(MASTRA_THREAD_ID_KEY, target.threadId);
    await agent.sendNotificationSignal(
      { source: 'computer', kind, priority: 'high', summary, attributes: { computerId: entry.id, ...attributes } },
      {
        resourceId: target.resourceId,
        threadId: target.threadId,
        ifIdle: {
          behavior: 'wake',
          streamOptions: { memory: { thread: target.threadId, resource: target.resourceId }, requestContext },
        },
      },
    );
  }

  /** The lifecycle toolset. Pixel actions come only from Workspace tools. */
  tools(): Record<string, ToolAction<any, any, any, any>> {
    if (this.#tools) return this.#tools;
    this.#tools = {
      [WORKSPACE_TOOLS.COMPUTER_LIFECYCLE.LIST]: createTool({
        id: WORKSPACE_TOOLS.COMPUTER_LIFECYCLE.LIST,
        description: 'List your computers.',
        inputSchema: z.object({}),
        execute: async (_input, context) => this.#list(context),
      }),
      [WORKSPACE_TOOLS.COMPUTER_LIFECYCLE.CREATE]: createTool({
        id: WORKSPACE_TOOLS.COMPUTER_LIFECYCLE.CREATE,
        description: 'Create a desktop computer and attach it to this conversation.',
        inputSchema: z.object({
          template: z.literal('desktop').optional(),
          name: z.string().max(64).optional(),
          persist: z.boolean().optional(),
        }),
        execute: async (input, context) => this.#create(input, context),
      }),
      [WORKSPACE_TOOLS.COMPUTER_LIFECYCLE.ATTACH]: createTool({
        id: WORKSPACE_TOOLS.COMPUTER_LIFECYCLE.ATTACH,
        description: 'Attach an existing computer to this conversation by id.',
        inputSchema: z.object({ id: z.string().max(256) }),
        execute: async (input, context) => this.#attachTool(input, context),
      }),
      [WORKSPACE_TOOLS.COMPUTER_LIFECYCLE.RELEASE]: createTool({
        id: WORKSPACE_TOOLS.COMPUTER_LIFECYCLE.RELEASE,
        description: 'Detach the computer from this conversation without destroying it.',
        inputSchema: z.object({}),
        execute: async (_input, context) => this.#release(context),
      }),
      [WORKSPACE_TOOLS.COMPUTER_LIFECYCLE.REQUEST_HUMAN]: createTool({
        id: WORKSPACE_TOOLS.COMPUTER_LIFECYCLE.REQUEST_HUMAN,
        description:
          'Ask the user to take over the attached computer (for example, to log in or solve a CAPTCHA). End your turn after calling this.',
        inputSchema: z.object({ reason: z.string().trim().min(1).max(NOTE_MAX) }),
        execute: async (input, context) => this.#requestHuman(input, context),
      }),
      [WORKSPACE_TOOLS.COMPUTER_LIFECYCLE.SNAPSHOT]: createTool({
        id: WORKSPACE_TOOLS.COMPUTER_LIFECYCLE.SNAPSHOT,
        description: "Save a checkpoint of the attached computer's state.",
        inputSchema: z.object({}),
        execute: async (_input, context) => {
          const scope = this.#scope(context);
          if (!scope) return MISSING_IDENTITY;
          const entry = await this.#attachedEntry(scope);
          const sandbox = entry?.sandbox ?? (await entry?.ready);
          if (!entry || !sandbox || entry.ownerResourceId !== scope.resourceId) return NOT_ATTACHED;
          const run = entry.queue.then(async () => {
            const refusal = this.#controlRefusal(entry);
            if (refusal) return refusal;
            const result = await sandbox.captureCheckpoint();
            return result.status === 'skipped' ? { status: result.status, reason: result.reason } : { status: result.status };
          });
          entry.queue = run.then(
            () => undefined,
            () => undefined,
          );
          return run;
        },
      }),
      [WORKSPACE_TOOLS.COMPUTER_LIFECYCLE.DESTROY]: createTool({
        id: WORKSPACE_TOOLS.COMPUTER_LIFECYCLE.DESTROY,
        description: 'Permanently destroy a computer by id.',
        inputSchema: z.object({ id: z.string().max(256) }),
        execute: async (input, context) => this.#destroy(input, context),
      }),
      ...(this.#handsExtension ? this.#handsExtension.tools(this.#handsHost()) : {}),
    };
    for (const tool of Object.values(this.#tools)) markOrderedTool(tool, COMPUTER_ORDERED_TOOL_GROUP);
    return this.#tools;
  }

  async #attachedEntry(scope: Scope): Promise<Entry | undefined> {
    const currentId = this.#attachments.get(scope.key);
    if (currentId) return this.#computers.get(currentId);
    const { threadState } = await this.#stores();
    const pointer = await threadState?.getState<StoredAttachment>({
      threadId: scope.threadId,
      type: `${ATTACHMENT_TYPE}:${scope.resourceId}`,
    });
    if (!pointer || pointer.schemaVersion !== 1) return undefined;
    const verified = this.#verify(pointer.computerId, scope.resourceId);
    if (!verified?.persistent) {
      await this.#deleteAttachment(scope);
      return undefined;
    }
    const entry = await this.#lookup(pointer.computerId, verified, scope.resourceId);
    if (!entry) {
      await this.#deleteAttachment(scope);
      return undefined;
    }
    if (pointer.control.revision > entry.control.revision) {
      entry.control = {
        holder: pointer.control.holder,
        ...(pointer.control.reason ? { reason: pointer.control.reason } : {}),
        revision: pointer.control.revision,
        enforcedRevision: pointer.control.enforcedRevision,
      };
      await this.#persistAttachment(scope, entry);
    }
    try {
      await entry.ready;
    } catch {
      return undefined;
    }
    this.#attachments.set(scope.key, entry.id);
    return entry;
  }

  async runComputerAction<T>(input: ComputerActionInput, fn: () => Promise<T>): Promise<T> {
    if (input.action === 'read') return fn();
    const scope = this.#scope(input.context);
    if (!scope) throw new Error(MISSING_IDENTITY);
    const entry = await this.#attachedEntry(scope);
    const sandbox = entry?.sandbox ?? (await entry?.ready);
    if (!entry || !sandbox || entry.ownerResourceId !== scope.resourceId || sandbox.sandboxId !== input.sandboxId) {
      throw new Error(NOT_ATTACHED);
    }
    const run = entry.queue.then(async () => {
      if (input.signal?.aborted) throw input.signal.reason ?? new Error('computer action aborted');
      const refusal = this.#controlRefusal(entry);
      if (refusal) throw new Error(refusal);
      return fn();
    });
    entry.queue = run.catch(() => {});
    return run;
  }

  /** Resolve the attached owned sandbox for Workspace pixel tools. */
  sandboxResolver(): WorkspaceSandboxResolver {
    return async ({ requestContext }) => {
      const scope = this.#scope({ requestContext } as Context);
      if (!scope) throw new Error(MISSING_IDENTITY);
      const entry = await this.#attachedEntry(scope);
      const sandbox = entry?.sandbox ?? (await entry?.ready);
      if (!sandbox || entry?.ownerResourceId !== scope.resourceId) throw new Error(NOT_ATTACHED);
      const refusal = this.#controlRefusal(entry);
      if (refusal) throw new Error(refusal);
      const workspaceSandbox = sandbox as unknown as WorkspaceSandbox;
      if (!workspaceSandbox.computer) return workspaceSandbox;
      const controlRefusal = () => this.#controlRefusal(entry);
      const computer = new Proxy(workspaceSandbox.computer, {
        get(target, property, receiver) {
          const value = Reflect.get(target, property, receiver);
          if (typeof value !== 'function') return value;
          return (...args: unknown[]) => {
            const refusal = controlRefusal();
            if (refusal) throw new Error(refusal);
            return Reflect.apply(value, target, args);
          };
        },
      });
      return new Proxy(workspaceSandbox, {
        get(target, property, receiver) {
          if (property === 'computer') return computer;
          if (property === 'id') return sandbox.sandboxId;
          return Reflect.get(target, property, receiver);
        },
      });
    };
  }

  /**
   * Upstream viewer access for a server-side proxy. `headers` must never reach the browser.
   * Returns `null` when the computer isn't running; throws when it isn't attached to this thread.
   */
  async viewer(computerId: string, scope: MastraComputerScope): Promise<MastraComputerViewer | null> {
    const sandbox = (await this.#attached(computerId, scope)).sandbox!;
    return this.#provider.viewer(sandbox, scope);
  }

  async embed(
    computerId: string,
    scope: MastraComputerScope,
    options: { origin: string; mode: 'watch' | 'control' },
  ): Promise<string | null> {
    if (!this.#provider.embed) return null;
    const sandbox = (await this.#attached(computerId, scope)).sandbox!;
    return this.#provider.embed(sandbox, options);
  }

  async #attached(computerId: string, scope: MastraComputerScope): Promise<Entry> {
    const fullScope = { ...scope, key: JSON.stringify([scope.resourceId, scope.threadId]) };
    const entry = await this.#attachedEntry(fullScope);
    if (entry?.id !== computerId || !entry.sandbox || entry.ownerResourceId !== scope.resourceId) {
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
    return {
      holder: control.holder,
      ...(control.reason !== undefined && { reason: control.reason }),
      revision: control.revision,
      enforced: control.enforcedRevision >= control.revision,
    };
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
    if (entry.control.holder === holder) {
      return { holder, revision: entry.control.revision, notified: false, reason: 'no-change' };
    }
    const key = JSON.stringify([scope.resourceId, scope.threadId]);
    const target =
      holder === 'human'
        ? { resourceId: scope.resourceId, threadId: scope.threadId, ...this.#agents.get(key) }
        : entry.control.target;
    entry.control = {
      holder,
      ...(holder === 'human' ? { reason: note ?? 'user took control', target } : {}),
      revision: entry.control.revision + 1,
      enforcedRevision: entry.control.enforcedRevision,
    };
    const enforced = await this.#enforceWithinDeadline(entry, scope);
    await this.#persistAttachment({ ...scope, key }, entry);
    if (!enforced) return { holder, revision: entry.control.revision, notified: false, reason: 'not-delivered' };
    return { holder, revision: entry.control.revision, ...(await this.#notify(entry, holder, target, note)) };
  }

  /** Tells the agent on the lease's thread that control changed hands. Never throws. */
  async #notify(
    entry: Entry,
    holder: 'agent' | 'human',
    target: Lease['target'],
    note: string | undefined,
  ): Promise<Omit<MastraComputerControlResult, 'holder' | 'revision'>> {
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
      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, target.resourceId);
      requestContext.set(MASTRA_THREAD_ID_KEY, target.threadId);
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
            streamOptions: {
              memory: { thread: target.threadId, resource: target.resourceId },
              requestContext,
            },
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
