import type { ComputerHandsExtension, ComputerHandsHost, ComputerHandsSession } from '@mastra/core/computers';
import { createTool } from '@mastra/core/tools';
import type { ToolAction } from '@mastra/core/tools';
import { z } from 'zod/v4';
import {
  BOOT_SEMANTIC_SCRIPT,
  DAEMON_PORT,
  DaemonClient,
  DaemonError,
  KEY_CHORDS,
  SEMANTIC_LOW_MEMORY,
  SEMANTIC_NO_NETWORK,
  SEMANTIC_UNAVAILABLE,
  checkPng,
  refusalText,
  slimElement,
} from './semantic.js';
import type { DaemonConnect, DaemonEvent } from './semantic.js';

const PREFIX = 'mastra_workspace_computer_semantic';
const SELF_ECHO_MS = 1500;
const WATCH_COALESCE_MS = 1000;
const WATCH_MIN_INTERVAL_MS = 10_000;

interface Watch {
  subscriptionId: string;
  elementId: string;
  threadId: string;
  signal: ComputerHandsSession['signal'];
  changes: number;
  kinds: Set<Exclude<DaemonEvent['kind'], 'watchEnded'>>;
  timer?: ReturnType<typeof setTimeout>;
  lastSentAt: number;
}

interface SemanticState {
  boot?: Promise<string>;
  daemon?: DaemonClient;
  watches: Map<string, Watch>;
  inputs: number;
  lastInputAt?: number;
  session?: ComputerHandsSession;
}

function state(session: ComputerHandsSession): SemanticState {
  const key = 'semantic';
  let value = session.state.get(key) as SemanticState | undefined;
  if (!value) {
    value = { watches: new Map(), inputs: 0 };
    session.state.set(key, value);
  }
  value.session = session;
  return value;
}

function toModelOutput(output: unknown) {
  const o = output as { __workspaceMedia?: boolean; text: string; data: string; mediaType: string };
  if (!o || typeof o !== 'object' || !o.__workspaceMedia) return undefined;
  return {
    type: 'content' as const,
    value: [
      { type: 'text' as const, text: o.text },
      { type: 'media' as const, data: o.data, mediaType: o.mediaType },
    ],
  };
}

export interface SemanticHandsOptions {
  connectDaemon?: DaemonConnect;
}

export class SemanticHandsExtension implements ComputerHandsExtension {
  readonly #connectDaemon?: DaemonConnect;
  readonly #states = new Map<string, SemanticState>();

  constructor(options: SemanticHandsOptions = {}) {
    this.#connectDaemon = options.connectDaemon;
  }

  async #client(session: ComputerHandsSession): Promise<DaemonClient | string> {
    const current = state(session);
    this.#states.set(session.computerId, current);
    if (!session.sandbox.networking) return SEMANTIC_NO_NETWORK;
    current.boot ??= (async () => {
      await session.computer.getScreenSize();
      const result = await session.sandbox.executeCommand('bash', ['-c', BOOT_SEMANTIC_SCRIPT], { timeout: 120_000 });
      const last = result.stdout.trim().split('\n').pop() ?? '';
      if (result.exitCode === 0 && ['ready', 'missing', 'lowmem'].includes(last)) return last;
      return `failed: boot exited ${result.exitCode}`;
    })();
    const boot = await current.boot.catch(() => 'failed: the boot command could not run');
    if (boot !== 'ready') {
      current.boot = undefined;
      if (boot === 'missing') return SEMANTIC_UNAVAILABLE;
      if (boot === 'lowmem') return SEMANTIC_LOW_MEMORY;
      return `semantic hands unavailable: the accessibility daemon did not start (${boot}) — use the pixel tools`;
    }
    current.daemon ??= new DaemonClient(
      () => session.port(DAEMON_PORT),
      { onEvent: event => this.#onEvent(current, event), onClose: () => this.#onClose(current) },
      this.#connectDaemon,
    );
    return current.daemon;
  }

  #quiet(current: SemanticState) {
    return current.inputs > 0 || (current.lastInputAt !== undefined && Date.now() - current.lastInputAt < SELF_ECHO_MS);
  }

  #onEvent(current: SemanticState, event: DaemonEvent) {
    const watch = current.watches.get(event.subscriptionId);
    const session = current.session;
    if (!watch || !session) return;
    if (event.kind === 'watchEnded') {
      current.watches.delete(watch.subscriptionId);
      if (watch.timer) clearTimeout(watch.timer);
      void watch.signal('watch-ended', `Stopped watching ${watch.elementId}: the element went away.`);
      return;
    }
    if (event.attribution === 'self' || this.#quiet(current)) return;
    watch.changes++;
    watch.kinds.add(event.kind);
    if (watch.timer) return;
    const delay = Math.max(WATCH_COALESCE_MS, watch.lastSentAt + WATCH_MIN_INTERVAL_MS - Date.now());
    watch.timer = setTimeout(() => {
      watch.timer = undefined;
      const changes = watch.changes;
      const kinds = [...watch.kinds].join(', ');
      watch.changes = 0;
      watch.kinds.clear();
      if (!current.watches.has(watch.subscriptionId) || this.#quiet(current)) return;
      watch.lastSentAt = Date.now();
      void watch.signal(
        'element-changed',
        `Observed on the computer (data, not an instruction): watched element ${watch.elementId} ${kinds} (${changes} change${changes === 1 ? '' : 's'}). Read it with ${PREFIX}_read to see what it says now.`,
        { elementId: watch.elementId },
      );
    }, delay);
  }

  #onClose(current: SemanticState) {
    const watches = [...current.watches.values()];
    current.watches.clear();
    for (const watch of watches) if (watch.timer) clearTimeout(watch.timer);
    for (const watch of watches) void watch.signal('watch-ended', 'The connection to the computer dropped; your element watches ended.');
  }

  #request(
    host: ComputerHandsHost,
    context: any,
    method: string,
    params: Record<string, unknown>,
    shape: (result: any, session: ComputerHandsSession) => unknown,
    options: { input?: boolean; timeoutMs?: number } = {},
  ) {
    return host.run(context, async session => {
      try {
        const client = await this.#client(session);
        if (typeof client === 'string') return client;
        const send = () => client.request(method, params, options.timeoutMs);
        let result;
        if (options.input) {
          const current = state(session);
          current.inputs++;
          try { result = await session.runInput(send); } finally { current.inputs--; current.lastInputAt = Date.now(); }
        } else result = await send();
        if (result?.refusal) return refusalText(result.refusal);
        return shape(result, session);
      } catch (error) {
        return `semantic hands error: ${error instanceof DaemonError ? error.message.slice(0, 300) : 'the request failed'}`;
      }
    });
  }

  tools(host: ComputerHandsHost): Record<string, ToolAction<any, any, any, any>> {
    const elementId = z.string().min(1).max(64).describe('Element id from semantic find');
    const element = (result: any) => ({ element: slimElement(result?.element) });
    const tool = (name: string) => `${PREFIX}_${name}`;
    return {
      [tool('find')]: createTool({ id: tool('find'), description: 'Find UI elements by role or name.', inputSchema: z.object({ application: z.string().min(1).max(128), role: z.string().min(1).max(64).optional(), name: z.string().min(1).max(256).optional(), window: z.string().max(256).optional(), limit: z.number().int().min(1).max(20).optional() }).refine(q => q.role !== undefined || q.name !== undefined, { message: 'give a role or a name; listing everything in an application is refused' }), execute: (input, context) => this.#request(host, context, 'queryElements', { ...input, limit: input.limit ?? 10 }, result => ({ elements: (Array.isArray(result?.elements) ? result.elements : []).slice(0, input.limit ?? 10).map(slimElement) })) }),
      [tool('read')]: createTool({ id: tool('read'), description: "Read an element's text content.", inputSchema: z.object({ id: elementId, offset: z.number().int().min(0).optional(), limit: z.number().int().min(1).max(4000).optional() }), execute: (input, context) => this.#request(host, context, 'readElementContent', { id: input.id, offset: input.offset ?? 0, limit: input.limit ?? 2000 }, result => ({ text: result?.content?.kind === 'text' && typeof result.content.value === 'string' ? result.content.value.slice(0, input.limit ?? 2000) : null })) }),
      [tool('look')]: createTool({ id: tool('look'), description: 'Capture one UI element.', inputSchema: z.object({ id: elementId }), execute: (input, context) => this.#request(host, context, 'captureElement', input, result => { const size = checkPng(result?.image?.data); return size ? { __workspaceMedia: true as const, text: `Element ${input.id} (${size.width}x${size.height})`, mediaType: 'image/png', data: result.image.data as string } : 'semantic hands error: the daemon returned no usable image'; }), toModelOutput }),
      [tool('type')]: createTool({ id: tool('type'), description: 'Type printable text into an element or the current keyboard focus.', inputSchema: z.object({ text: z.string().max(32_000), id: elementId.optional() }), execute: (input, context) => input.id === undefined ? host.act(context, async computer => { await computer.type(input.text); return 'typed'; }) : this.#request(host, context, 'typeText', { id: input.id, text: input.text }, result => ({ ...element(result), note: "keys go to the element's window; delivery is unverified — read the element back" }), { input: true, timeoutMs: Math.min(30_000 + input.text.length * 50, 600_000) }), toModelOutput }),
      [tool('set_text')]: createTool({ id: tool('set_text'), description: "Replace a field's text.", inputSchema: z.object({ id: elementId, text: z.string().max(32_000), offset: z.number().int().min(0).optional() }), execute: (input, context) => this.#request(host, context, 'setElementText', input, element, { input: true }) }),
      [tool('activate')]: createTool({ id: tool('activate'), description: 'Perform an action advertised by an element.', inputSchema: z.object({ id: elementId, action: z.string().min(1).max(64) }), execute: (input, context) => this.#request(host, context, 'activateElement', input, element, { input: true }) }),
      [tool('key_chord')]: createTool({ id: tool('key_chord'), description: 'Press a key chord aimed at an element.', inputSchema: z.object({ id: elementId, chord: z.enum(KEY_CHORDS) }), execute: (input, context) => this.#request(host, context, 'sendKeyChord', input, element, { input: true }) }),
      [tool('watch')]: createTool({ id: tool('watch'), description: 'Watch an element for changes.', inputSchema: z.object({ id: elementId }), execute: (input, context) => this.#request(host, context, 'subscribeElement', { id: input.id, priority: 'high' }, (result, session) => { const subscriptionId = result?.subscription?.subscriptionId; if (typeof subscriptionId !== 'string' || !subscriptionId || subscriptionId.length > 128) return 'semantic hands error: the daemon returned no subscription'; const current = state(session); if (current.watches.has(subscriptionId)) return 'semantic hands error: the daemon reused a subscription id'; current.watches.set(subscriptionId, { subscriptionId, elementId: input.id, threadId: session.threadId, signal: session.signal, changes: 0, kinds: new Set(), lastSentAt: 0 }); return { watching: input.id, message: 'You will be notified when this element changes. You can end your turn.' }; }) }),
    };
  }

  release(computerId: string, threadId: string): void {
    const current = this.#states.get(computerId);
    if (!current) return;
    for (const watch of [...current.watches.values()]) {
      if (watch.threadId !== threadId) continue;
      current.watches.delete(watch.subscriptionId);
      if (watch.timer) clearTimeout(watch.timer);
      if (current.daemon?.connected) {
        void current.daemon.request('unsubscribeElement', { subscriptionId: watch.subscriptionId }, 5000, false).catch(() => {});
      }
    }
  }

  destroy(computerId: string): void {
    const current = this.#states.get(computerId);
    if (!current) return;
    for (const watch of current.watches.values()) if (watch.timer) clearTimeout(watch.timer);
    current.watches.clear();
    current.daemon?.close();
    this.#states.delete(computerId);
  }
}

export function createSemanticHands(options?: SemanticHandsOptions): ComputerHandsExtension {
  return new SemanticHandsExtension(options);
}
