/**
 * Eval Context Builder for MastraCode
 *
 * Converts Harness session data into scorer-compatible format.
 * Supports both agent-type scorers (ScorerRunInputForAgent) and
 * trajectory scorers (Trajectory).
 */

import type { MastraDBMessage } from '@mastra/core/agent';
import { extractTrajectoryFromTrace } from '@mastra/core/evals';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent, Trajectory } from '@mastra/core/evals';
import type { Harness } from '@mastra/core/harness';
import type { CoreMessage, CoreSystemMessage } from '@mastra/core/llm';
import type { MastraCompositeStore } from '@mastra/core/storage';

export type MastraCodeEvalContext = {
  /** Scorer-compatible agent input (messages, system prompt, etc.) */
  agentInput: ScorerRunInputForAgent;
  /** Scorer-compatible agent output (response messages) */
  agentOutput: ScorerRunOutputForAgent;
  /** Execution trajectory extracted from trace spans */
  trajectory: Trajectory | undefined;
  /** Request context with session metadata */
  requestContext: Record<string, unknown>;
  /** The thread ID this context was built from */
  threadId: string;
  /** The trace ID for observability linkage */
  traceId: string | undefined;
};

export type BuildContextOptions = {
  /** Harness instance to extract data from */
  harness: Harness<any>;
  /** Thread ID to build context for (defaults to current thread) */
  threadId?: string;
  /** Limit messages to the last N turns (user+assistant pairs). Undefined = all messages */
  lastNTurns?: number;
};

/**
 * Build an evaluation context from a Harness session.
 *
 * This extracts messages from storage, builds trajectory from trace spans,
 * and packages everything into the format scorers expect.
 */
export async function buildEvalContext(options: BuildContextOptions): Promise<MastraCodeEvalContext> {
  const { harness, lastNTurns } = options;
  const threadId = options.threadId ?? harness.getCurrentThreadId();

  if (!threadId) {
    throw new Error('No thread ID available. Start a session before building eval context.');
  }

  const mastra = harness.getMastra();
  const storage = mastra?.getStorage();

  // 1. Get raw MastraDB messages from memory storage
  const rawMessages = await getRawMessages(storage, threadId, lastNTurns);

  // 2. Split messages into input/output categories
  const { inputMessages, systemMessages, outputMessages } = categorizeMessages(rawMessages);

  // 3. Extract trajectory from observability traces
  const { trajectory, traceId } = await extractSessionTrajectory(storage, threadId);

  // 4. Build request context from Harness state
  const requestContext = buildRequestContext(harness, threadId);

  return {
    agentInput: {
      inputMessages,
      rememberedMessages: [], // Harness doesn't separate these; memory recall is transparent
      systemMessages,
      taggedSystemMessages: {},
    },
    agentOutput: outputMessages,
    trajectory,
    requestContext,
    threadId,
    traceId,
  };
}

/**
 * Fetch raw MastraDBMessage[] from memory storage for a thread.
 */
async function getRawMessages(
  storage: MastraCompositeStore | undefined,
  threadId: string,
  lastNTurns?: number,
): Promise<MastraDBMessage[]> {
  if (!storage) return [];

  const memoryStore = await storage.getStore('memory');
  if (!memoryStore) return [];

  const result = await memoryStore.listMessages({
    threadId,
    perPage: false,
  });

  let messages = result.messages;

  if (lastNTurns !== undefined && lastNTurns > 0) {
    messages = trimToLastNTurns(messages, lastNTurns);
  }

  return messages;
}

/**
 * Trim messages to the last N user-assistant turn pairs.
 */
function trimToLastNTurns(messages: MastraDBMessage[], turns: number): MastraDBMessage[] {
  // Walk backward, counting user messages as turn boundaries.
  // When we find the Nth user message, slice from there to include
  // that turn and everything after it.
  let turnCount = 0;
  let cutoffIndex = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === 'user') {
      turnCount++;
      if (turnCount === turns) {
        cutoffIndex = i;
        break;
      }
    }
  }

  return messages.slice(cutoffIndex);
}

/**
 * Categorize messages into input (user), system, and output (assistant) groups.
 */
function categorizeMessages(messages: MastraDBMessage[]): {
  inputMessages: MastraDBMessage[];
  systemMessages: CoreMessage[];
  outputMessages: MastraDBMessage[];
} {
  const inputMessages: MastraDBMessage[] = [];
  const systemMessages: CoreSystemMessage[] = [];
  const outputMessages: MastraDBMessage[] = [];

  for (const msg of messages) {
    switch (msg.role) {
      case 'user':
        inputMessages.push(msg);
        break;
      case 'system':
        systemMessages.push({
          role: 'system',
          content: extractTextContent(msg),
        });
        break;
      case 'assistant':
        outputMessages.push(msg);
        break;
    }
  }

  return { inputMessages, systemMessages, outputMessages };
}

/**
 * Extract plain text content from a MastraDBMessage.
 */
function extractTextContent(msg: MastraDBMessage): string {
  if (!msg.content?.parts) return '';

  return msg.content.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text' && 'text' in p)
    .map(p => p.text)
    .join('\n');
}

/**
 * Extract trajectory from trace spans in observability storage.
 * Looks up traces by threadId metadata.
 */
async function extractSessionTrajectory(
  storage: MastraCompositeStore | undefined,
  threadId: string,
): Promise<{ trajectory: Trajectory | undefined; traceId: string | undefined }> {
  if (!storage) return { trajectory: undefined, traceId: undefined };

  try {
    const observabilityStore = await storage.getStore('observability');
    if (!observabilityStore) return { trajectory: undefined, traceId: undefined };

    // Find traces associated with this thread
    const result = await observabilityStore.listTraces({
      filters: { threadId },
      pagination: { page: 0, perPage: 1 },
      orderBy: { field: 'startedAt', direction: 'DESC' },
    });

    if (!result?.spans?.length) return { trajectory: undefined, traceId: undefined };

    const traceId = result.spans[0]!.traceId;
    const trace = await observabilityStore.getTrace({ traceId });

    if (!trace?.spans?.length) return { trajectory: undefined, traceId };

    const trajectory = extractTrajectoryFromTrace(trace.spans);
    return { trajectory, traceId };
  } catch {
    // Trace extraction is best-effort
    return { trajectory: undefined, traceId: undefined };
  }
}

/**
 * Build request context from Harness state for scorer evaluation.
 */
function buildRequestContext(harness: Harness<any>, threadId: string): Record<string, unknown> {
  const state = harness.getState() as Record<string, unknown>;

  return {
    threadId,
    mode: state.currentMode ?? state.mode,
    modelId: state.currentModelId,
    projectPath: state.projectPath,
    projectName: state.projectName,
    gitBranch: state.gitBranch,
    thinkingLevel: state.thinkingLevel,
    yolo: state.yolo,
    smartEditing: state.smartEditing,
  };
}
