import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';
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

const ID_PATTERN = /^cmp_([pe])_([A-Za-z0-9-]{1,128})_([A-Za-z0-9_-]{22})$/;
const SANDBOX_ID_PATTERN = /^[A-Za-z0-9-]{1,128}$/;
const MAC_VERSION = 'mastra-computer-v1';

/** The part of a sandbox the computers toolset drives. */
export interface ComputerSandbox {
  readonly sandboxId: string | undefined;
  computer?: SandboxComputer;
  start(): Promise<unknown>;
  destroy(): Promise<void>;
  captureCheckpoint(): Promise<CaptureCheckpointResult>;
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
  seq: number;
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

  #mac(flag: 'p' | 'e', sandboxId: string, ownerResourceId: string): Buffer {
    const message = JSON.stringify([MAC_VERSION, flag, sandboxId, ownerResourceId, this.#environmentId]);
    return createHmac('sha256', this.#key).update(message, 'utf8').digest().subarray(0, 16);
  }

  /** @internal */
  mintId(persistent: boolean, sandboxId: string, ownerResourceId: string): string {
    const flag = persistent ? 'p' : 'e';
    return `cmp_${flag}_${sandboxId}_${this.#mac(flag, sandboxId, ownerResourceId).toString('base64url')}`;
  }

  #verify(id: unknown, ownerResourceId: string): { persistent: boolean; sandboxId: string } | undefined {
    if (typeof id !== 'string') return undefined;
    const match = ID_PATTERN.exec(id);
    if (!match) return undefined;
    const [, flag, sandboxId, mac] = match as unknown as [string, 'p' | 'e', string, string];
    const given = Buffer.from(mac, 'base64url');
    const expected = this.#mac(flag, sandboxId, ownerResourceId);
    // 22 base64url chars carry 132 bits; reject non-canonical aliases of the same 16 bytes.
    if (given.length !== expected.length || given.toString('base64url') !== mac) return undefined;
    if (!timingSafeEqual(given, expected)) return undefined;
    return { persistent: flag === 'p', sandboxId };
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
    this.#attachments.set(scope.key, entry.id);
  }

  /** Runs `fn` on the computer attached to this thread, in call order. Takes the slot synchronously. */
  #hands<T>(context: Context, fn: (sandbox: ComputerSandbox, computer: SandboxComputer) => Promise<T>) {
    const scope = this.#scope(context);
    if (!scope) return Promise.resolve(MISSING_IDENTITY);
    const id = this.#attachments.get(scope.key);
    const entry = id ? this.#computers.get(id) : undefined;
    if (!entry || entry.ownerResourceId !== scope.resourceId) return Promise.resolve(NOT_ATTACHED);
    if (entry.control.holder === 'human') return Promise.resolve(HUMAN_HAS_CONTROL);
    // Re-checked when the action runs: a take while earlier actions are in flight refuses the rest.
    const run = entry.queue.then((): T | string | Promise<T> =>
      entry.control.holder === 'human' ? HUMAN_HAS_CONTROL : fn(entry.sandbox!, entry.sandbox!.computer!),
    );
    entry.queue = run.catch(() => {});
    return run;
  }

  /** Same-process entry, or a pending reattach of a persistent id stored before any await. */
  #lookup(id: string, verified: { persistent: boolean; sandboxId: string }, ownerResourceId: string) {
    const existing = this.#computers.get(id);
    if (existing) return existing;
    if (!verified.persistent) return undefined;
    const sandbox = this.#createSandbox({
      ...this.#sandboxOptions,
      sandboxId: verified.sandboxId,
      computer: true,
      reattach: 'required',
    });
    const entry: Entry = {
      id,
      ready: sandbox.start().then(() => sandbox),
      name: 'computer',
      template: 'desktop',
      persistent: true,
      ownerResourceId,
      queue: Promise.resolve(),
      destroyed: false,
      control: { holder: 'agent', seq: 0 },
    };
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
      const sandbox = this.#createSandbox({ ...this.#sandboxOptions, computer: true });
      let entry: Entry | undefined;
      try {
        await sandbox.start();
        const sandboxId = sandbox.sandboxId;
        if (!sandboxId || !SANDBOX_ID_PATTERN.test(sandboxId)) throw new Error('unexpected sandbox id');
        entry = {
          id: this.mintId(persistent, sandboxId, scope.resourceId),
          ready: Promise.resolve(sandbox),
          sandbox,
          name: input.name?.trim() || 'computer',
          template: 'desktop',
          persistent,
          ownerResourceId: scope.resourceId,
          queue: Promise.resolve(),
          destroyed: false,
          control: { holder: 'agent', seq: 0 },
        };
      } catch {
        await sandbox.destroy().catch(() => {});
        return UNAVAILABLE;
      }
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
      const entry = this.#lookup(input.id, verified, scope.resourceId);
      if (!entry || entry.destroyed) return NOT_FOUND;
      try {
        await entry.ready;
      } catch (error) {
        return isReattachFailure(error) ? NOT_FOUND : UNAVAILABLE;
      }
      if (entry.destroyed) return NOT_FOUND;
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
      if (!entry) return NOT_ATTACHED;
      await this.#emit(context, entry, scope.threadId, 'released');
      return { computer: this.#describe(entry, 'released') };
    });
  }

  #destroy(input: { id: string }, context: Context) {
    return this.#serial(context, async scope => {
      const verified = this.#verify(input.id, scope.resourceId);
      if (!verified) return NOT_FOUND;
      const entry = this.#lookup(input.id, verified, scope.resourceId);
      if (!entry || entry.destroyed) return NOT_FOUND;
      if (entry.control.holder === 'human') return HUMAN_HAS_CONTROL;
      entry.destroyed = true;
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
      if (releasedHere) await this.#emit(context, entry, scope.threadId, 'released');
      return { destroyed: entry.id };
    });
  }

  #requestHuman(input: { reason: string }, context: Context) {
    const scope = this.#scope(context);
    if (!scope) return MISSING_IDENTITY;
    const id = this.#attachments.get(scope.key);
    const entry = id ? this.#computers.get(id) : undefined;
    if (!entry || entry.ownerResourceId !== scope.resourceId || !entry.sandbox || entry.destroyed) return NOT_ATTACHED;
    const reason = input.reason.trim();
    if (entry.control.holder !== 'human') {
      entry.control = {
        holder: 'human',
        reason,
        target: { resourceId: scope.resourceId, threadId: scope.threadId, ...this.#agents.get(scope.key) },
        seq: entry.control.seq + 1,
      };
    }
    const shown = entry.control.reason ?? reason;
    void (async () => {
      try {
        await context?.writer?.custom({
          type: 'data-computer',
          data: { computerId: entry.id, threadId: scope.threadId, control: 'human', reason: shown },
        });
      } catch {
        // A closed stream must not undo the handoff.
      }
    })();
    return {
      computerId: entry.id,
      reason: shown,
      control: 'human' as const,
      message: 'Stop using the computer and end your turn. You will be notified when the user hands it back.',
    };
  }

  #list(context: Context) {
    const scope = this.#scope(context);
    if (!scope) return MISSING_IDENTITY;
    const attachedId = this.#attachments.get(scope.key);
    const computers = [...this.#computers.values()]
      .filter(e => e.ownerResourceId === scope.resourceId && e.sandbox && !e.destroyed)
      .map(e => this.#describe(e, e.id === attachedId ? 'attached' : 'available'));
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
    const sandbox = this.#attached(computerId, scope).sandbox!;
    const url = await sandbox.computer?.streamUrl?.();
    if (!url) return null;
    const cookie = await sandbox.getPortAuthCookie(COMPUTER_VIEWER_PORT);
    if (!cookie) return null;
    return { url, headers: { cookie: `${cookie.name}=${cookie.value}` } };
  }

  #attached(computerId: string, scope: MastraComputerScope): Entry {
    const entry = this.#computers.get(computerId);
    const key = JSON.stringify([scope.resourceId, scope.threadId]);
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
    const { control } = this.#attached(computerId, scope);
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
    const entry = this.#attached(computerId, scope);
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
        ? { holder, reason: 'user took control', target, seq: entry.control.seq + 1 }
        : { holder, seq: entry.control.seq + 1 };
    return { holder, ...(await this.#notify(entry, holder, target, note)) };
  }

  async #notify(
    _entry: Entry,
    _holder: 'agent' | 'human',
    _target: Lease['target'],
    _note: string | undefined,
  ): Promise<Omit<MastraComputerControlResult, 'holder'>> {
    return { notified: false, reason: 'no-agent' };
  }
}
