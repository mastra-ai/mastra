/**
 * emit() / withPulse() / reconstruct() — Exploration Sketch
 *
 * The entire context propagation and emission system.
 * Compare this to the current system's ~800 lines of context.ts + context-factory.ts +
 * utils.ts + ObservabilityContext + TracingContext + wrapMastra + wrapAgent + wrapWorkflow.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

// ---------------------------------------------------------------------------
// Types (from 01-pulse-types.ts)
// ---------------------------------------------------------------------------

interface Pulse {
  id: string;
  parentId?: string;
  ts: number;
  kind: string;
  data?: Record<string, unknown>;
  duration?: number;
  targets?: string;
  error?: { message: string; stack?: string; [key: string]: unknown };
}

// ---------------------------------------------------------------------------
// The pulse store — just an append-only list for now
// ---------------------------------------------------------------------------

interface PulseStore {
  append(pulse: Pulse): void;
  get(id: string): Pulse | undefined;
  getChildren(parentId: string): Pulse[];
  getAncestorChain(id: string): Pulse[]; // [self, parent, grandparent, ...]
  all(): Pulse[];
}

/**
 * Simplest possible in-memory store. In reality this would be pluggable
 * (file, database, streaming endpoint, etc.)
 */
function createMemoryStore(): PulseStore {
  const pulses: Pulse[] = [];
  const byId = new Map<string, Pulse>();

  return {
    append(pulse: Pulse) {
      pulses.push(pulse);
      byId.set(pulse.id, pulse);
    },

    get(id: string) {
      return byId.get(id);
    },

    getChildren(parentId: string) {
      return pulses.filter(p => p.parentId === parentId);
    },

    getAncestorChain(id: string) {
      const chain: Pulse[] = [];
      let current = byId.get(id);
      while (current) {
        chain.push(current);
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }
      return chain;
    },

    all() {
      return [...pulses];
    },
  };
}

// ---------------------------------------------------------------------------
// Context propagation — the whole thing
// ---------------------------------------------------------------------------

/**
 * This is the ENTIRE context propagation system.
 *
 * Compare to current:
 * - TracingContext { currentSpan?: AnySpan }
 * - ObservabilityContext { tracing, loggerVNext, metrics, tracingContext }
 * - wrapMastra() (Proxy)
 * - wrapAgent() (Proxy)
 * - wrapWorkflow() (Proxy)
 * - wrapRun() (Proxy)
 * - createObservabilityContext()
 * - resolveObservabilityContext()
 * - getOrCreateSpan()
 */
const currentPulseId = new AsyncLocalStorage<string>();

// That's it. One line.

// ---------------------------------------------------------------------------
// emit() — create a pulse, automatically parented to current context
// ---------------------------------------------------------------------------

let store: PulseStore = createMemoryStore();
let idCounter = 0;

function generateId(): string {
  // In reality: crypto.randomUUID() or similar
  return `p${++idCounter}`;
}

/**
 * Emit a pulse. Returns the pulse ID.
 *
 * The pulse is automatically parented to whatever pulse is "current"
 * via AsyncLocalStorage. No need to pass context, no Proxies, no wrapping.
 */
function emit(input: Omit<Pulse, 'id' | 'parentId' | 'ts'>): string {
  const id = generateId();
  const pulse: Pulse = {
    ...input,
    id,
    parentId: currentPulseId.getStore(),
    ts: Date.now(),
  };
  store.append(pulse);
  return id;
}

// ---------------------------------------------------------------------------
// withPulse() — run code "inside" a pulse scope
// ---------------------------------------------------------------------------

/**
 * Execute a function within a pulse's scope. Any pulses emitted inside
 * the function will automatically have this pulse as their parent.
 *
 * This replaces:
 * - TracingContext threading
 * - wrapMastra/wrapAgent/wrapWorkflow Proxies
 * - createObservabilityContext()
 */
function withPulse<T>(pulseId: string, fn: () => T): T {
  return currentPulseId.run(pulseId, fn);
}

// Async version (AsyncLocalStorage handles this natively, but explicit for clarity)
async function withPulseAsync<T>(pulseId: string, fn: () => Promise<T>): Promise<T> {
  return currentPulseId.run(pulseId, fn);
}

// ---------------------------------------------------------------------------
// scope() — emit a start pulse and run code inside its scope
// ---------------------------------------------------------------------------

/**
 * Convenience: emit a start pulse, run the function inside its scope,
 * emit an end pulse when done.
 *
 * This is the pulse equivalent of startSpan() + span.end().
 */
async function scope<T>(
  kind: string,
  data: Record<string, unknown> | undefined,
  fn: () => Promise<T>,
): Promise<{ result: T; pulseId: string }> {
  const startKind = kind.includes('.') ? kind : `${kind}.start`;
  const endKind = startKind.replace('.start', '.end');

  const pulseId = emit({ kind: startKind, data });
  const startTs = Date.now();

  try {
    const result = await withPulseAsync(pulseId, fn);
    emit({
      kind: endKind,
      targets: pulseId,
      duration: Date.now() - startTs,
      // Note: the caller can emit more specific end-data inside fn
      // This is just the structural close
    });
    return { result, pulseId };
  } catch (err) {
    emit({
      kind: endKind,
      targets: pulseId,
      duration: Date.now() - startTs,
      error: {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// reconstruct() — get full state at any pulse
// ---------------------------------------------------------------------------

/**
 * Walk the ancestor chain and merge data to get the full state at a given pulse.
 *
 * Merge rules:
 * - Scalars: child replaces parent
 * - Objects: deep merge (child keys override parent keys)
 * - Arrays: NOT auto-merged (use explicit delta fields like `newMessages`)
 */
function reconstruct(pulseId: string): Record<string, unknown> {
  const chain = store.getAncestorChain(pulseId); // [self, parent, grandparent, ...]
  const state: Record<string, unknown> = {};

  // Walk from root to leaf
  for (const pulse of chain.reverse()) {
    if (pulse.data) {
      deepMerge(state, pulse.data);
    }
  }

  return state;
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(source)) {
    const targetVal = target[key];
    const sourceVal = source[key];

    if (
      sourceVal !== null &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      targetVal !== null &&
      typeof targetVal === 'object' &&
      !Array.isArray(targetVal)
    ) {
      deepMerge(targetVal as Record<string, unknown>, sourceVal as Record<string, unknown>);
    } else {
      // Scalars replace. Arrays replace (use delta fields for append semantics).
      target[key] = sourceVal;
    }
  }
}

// ---------------------------------------------------------------------------
// Example: what agent code would look like
// ---------------------------------------------------------------------------

/*
// CURRENT agent.ts (simplified):

async generate(messages, options) {
  const agentSpan = getOrCreateSpan({
    type: SpanType.AGENT_RUN,
    name: `agent run: '${this.id}'`,
    entityType: EntityType.AGENT,
    entityId: this.id,
    entityName: this.name,
    input: options.messages,
    attributes: { conversationId, instructions, availableTools, maxSteps },
    metadata: { runId, resourceId, threadId },
    tracingPolicy: this.#options?.tracingPolicy,
    tracingOptions: options.tracingOptions,
    tracingContext: options.tracingContext,
    requestContext,
    mastra: this.#mastra,
  });

  // ... do work with tracingContext threading through Proxies ...

  agentSpan?.end({ output: result });
}

// WITH PULSES:

async generate(messages, options) {
  const { result } = await scope('agent', {
    agent: { id: this.id, name: this.name, model: this.model.modelId },
    tools: Object.keys(this.tools),
    input: messages,
    threadId: options.threadId,
  }, async () => {
    // Everything inside here automatically has the agent pulse as parent.
    // No Proxies. No context threading. Just AsyncLocalStorage.

    const modelResult = await this.callModel(messages);
    return modelResult;
  });

  return result;
}

// Inside callModel:

async callModel(messages) {
  // This automatically nests under the agent pulse
  const { result } = await scope('model', {
    model: this.model.modelId,
    newMessages: messages,  // delta: only the messages we're sending
  }, async () => {
    const response = await this.model.generate(messages);

    // Emit end data (usage, finish reason) — targets the model.start pulse
    emit({
      kind: 'model.end',
      targets: currentPulseId.getStore(),
      data: {
        usage: response.usage,
        finishReason: response.finishReason,
        output: response.text,
      },
    });

    return response;
  });

  return result;
}
*/

// ---------------------------------------------------------------------------
// Example: what a tool call would look like
// ---------------------------------------------------------------------------

/*
async executeTool(toolName, args) {
  const pulseId = emit({
    kind: 'tool.call',
    data: { tool: toolName, input: args },
  });

  try {
    const result = await withPulseAsync(pulseId, () => this.tools[toolName].execute(args));

    emit({
      kind: 'tool.result',
      targets: pulseId,
      data: { output: result },
    });

    return result;
  } catch (err) {
    emit({
      kind: 'tool.result',
      targets: pulseId,
      error: { message: err.message },
    });
    throw err;
  }
}
*/

// ---------------------------------------------------------------------------
// Example: logging is just emit()
// ---------------------------------------------------------------------------

/*
// Current:
loggerVNext.warn("Rate limit approaching", { remaining: 5 });

// With pulses:
emit({ kind: 'log.warn', data: { message: "Rate limit approaching", remaining: 5 } });

// The log is automatically correlated to whatever operation is in progress
// because parentId comes from AsyncLocalStorage. No manual correlation needed.
*/

export { emit, withPulse, withPulseAsync, scope, reconstruct, createMemoryStore };
export type { Pulse, PulseStore };
