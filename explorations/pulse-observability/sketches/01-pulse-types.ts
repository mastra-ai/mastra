/**
 * Pulse Types — Exploration Sketch
 *
 * NOT implementation. Just thinking through what the types would look like
 * when you actually try to use them.
 */

// ---------------------------------------------------------------------------
// The Pulse
// ---------------------------------------------------------------------------

export interface Pulse {
  /** Unique pulse ID */
  id: string;

  /** Parent pulse ID — forms the tree */
  parentId?: string;

  /** Timestamp (epoch ms) */
  ts: number;

  /** What happened — dot-namespaced convention */
  kind: PulseKind;

  /**
   * The actual data — serialized from real Mastra types.
   * Only NEW or CHANGED data relative to parent (delta encoding).
   */
  data?: Record<string, unknown>;

  /**
   * Duration in ms — present on "end" pulses or instant timed events.
   */
  duration?: number;

  /**
   * If this pulse closes a scope opened by another pulse.
   * Example: agent.end targets the agent.start pulse.
   * The data on this pulse "belongs to" the targeted scope.
   */
  targets?: string;

  /** Error info if something went wrong */
  error?: PulseError;
}

export interface PulseError {
  message: string;
  stack?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Kind taxonomy
// ---------------------------------------------------------------------------

/**
 * Core kinds that get autocomplete. The `(string & {})` union allows
 * arbitrary extension kinds while keeping autocomplete for known ones.
 */
type CorePulseKind =
  // Agent lifecycle
  | 'agent.start'
  | 'agent.end'

  // Model / LLM calls
  | 'model.start'
  | 'model.end'
  | 'model.chunk' // only in verbose mode

  // Tools
  | 'tool.call'
  | 'tool.result'

  // MCP tools (still just tools, but from MCP servers)
  | 'mcp.call'
  | 'mcp.result'

  // Processors (input/output)
  | 'processor.start'
  | 'processor.end'

  // Workflows
  | 'workflow.start'
  | 'workflow.end'
  | 'workflow.step.start'
  | 'workflow.step.end'
  | 'workflow.suspend'
  | 'workflow.resume'

  // Signals (replacing logs, metrics, scores, feedback)
  | 'log.debug'
  | 'log.info'
  | 'log.warn'
  | 'log.error'
  | 'log.fatal'
  | 'metric'
  | 'score'
  | 'feedback';

export type PulseKind = CorePulseKind | (string & {});

// ---------------------------------------------------------------------------
// Comparison: what does an agent.start pulse carry vs an AGENT_RUN span?
// ---------------------------------------------------------------------------

/*
TODAY — creating an AGENT_RUN span:

  const agentSpan = getOrCreateSpan({
    type: SpanType.AGENT_RUN,
    name: `agent run: '${this.id}'`,
    entityType: EntityType.AGENT,
    entityId: this.id,
    entityName: this.name,
    input: options.messages,
    attributes: {
      conversationId: threadFromArgs?.id,
      instructions: this.#convertInstructionsToString(instructions),
      availableTools: this.tools.map(t => t.name),
      maxSteps: this.maxSteps,
    },
    metadata: {
      runId,
      resourceId,
      threadId: threadFromArgs?.id,
    },
    tracingPolicy: this.#options?.tracingPolicy,
    tracingOptions: options.tracingOptions,
    tracingContext: options.tracingContext,
    requestContext,
    mastra: this.#mastra,
  });

WITH PULSES:

  const pulseId = emit({
    kind: 'agent.start',
    data: {
      agent: {
        id: this.id,
        name: this.name,
        model: this.model.modelId,
        tools: Object.keys(this.tools),
        maxSteps: this.maxSteps,
      },
      input: options.messages,
      threadId: threadFromArgs?.id,
      runId,
    },
  });

That's it. No entityType/entityId/entityName. No separate attributes interface.
No tracingPolicy, tracingContext, requestContext, mastra reference.
The data IS the domain data, serialized directly.
*/

// ---------------------------------------------------------------------------
// What about type safety on pulse data?
// ---------------------------------------------------------------------------

/**
 * We lose Span<SpanType.MODEL_GENERATION>.attributes: ModelGenerationAttributes
 * type safety. But we can get something back with optional type helpers:
 */

// The helper doesn't change the Pulse type — it's just a convenience for emitters
interface AgentStartData {
  agent: {
    id: string;
    name?: string;
    model?: string;
    tools?: string[];
    maxSteps?: number;
    instructions?: string;
  };
  input?: unknown;
  threadId?: string;
  runId?: string;
}

interface ModelEndData {
  output?: unknown;
  finishReason?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

// Usage: typed helper, but the Pulse itself is still Record<string, unknown>
function emitTyped<T extends Record<string, unknown>>(
  kind: PulseKind,
  data: T,
  options?: { targets?: string },
): string {
  // Just calls emit() — the type parameter is for the emitter's benefit only
  return emit({ kind, data, ...options });
}

// Example:
// emitTyped<AgentStartData>('agent.start', { agent: { id: 'support' }, input: messages });
// emitTyped<ModelEndData>('model.end', { usage: { inputTokens: 150 } }, { targets: modelPulseId });

// This gives the emitter autocomplete on data fields without requiring
// consumers to know about typed data interfaces. Best of both worlds?

// ---------------------------------------------------------------------------
// Placeholder — would be replaced by actual implementation
// ---------------------------------------------------------------------------

declare function emit(pulse: Omit<Pulse, 'id' | 'parentId' | 'ts'>): string;
