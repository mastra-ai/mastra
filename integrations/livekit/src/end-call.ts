// Server-safe: only depends on `@mastra/core` + zod, never the `@livekit/agents` runtime — so it
// can be added to agents defined in server/shared code and re-exported from the root entry
// (`index.ts`). `index.test.ts` enforces that boundary.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/** Details of the agent's decision to end the call, handed to {@link EndCallToolOptions.onEndCall}. */
export interface EndCallRequest {
  /** Short reason the agent gave for ending the call, if any (e.g. "caller said goodbye"). */
  reason?: string;
  /** The caller the call belongs to (the memory `resource`), when the call is memory-scoped. */
  resourceId?: string;
  /** The call thread, when the call is memory-scoped. */
  threadId?: string;
}

export interface EndCallToolOptions {
  /**
   * Tool id the agent calls to end the call. Must match the worker's
   * `configuration.endCall.tool` (both default to `'endCall'`), since that's the name the worker
   * watches for to hang up.
   */
  id?: string;
  /** Override the description the model sees when deciding to call the tool. */
  description?: string;
  /**
   * Optional bookkeeping hook, called when the agent invokes the tool (records the reason, marks
   * the call resolved in your CRM, …). Runs inside the turn — keep it quick. It does NOT hang up
   * the call; the worker does that once the agent's final words finish playing. The tool reads the
   * caller's identity from its execution context and passes it here.
   */
  onEndCall?: (request: EndCallRequest) => void | Promise<void>;
}

const DEFAULT_DESCRIPTION =
  'End the phone call. Call this only after you have said goodbye and there is nothing left to do — ' +
  'for example the caller says goodbye, or the task is complete and you have wrapped up. Say your ' +
  'closing line first, then call this as your final action; the call hangs up once your words finish ' +
  'playing. Do not call it if the caller still needs something.';

/**
 * Builds a Mastra tool the agent calls to end the call itself (say goodbye → hang up). It is the
 * agent-visible half of agent-initiated hang-up: the tool only SIGNALS intent (and runs optional
 * bookkeeping) — it can't reach the LiveKit room from inside `agent.stream()`. The worker owns the
 * hang-up: with `configuration.endCall` set, it watches each turn for this tool, waits for the
 * agent's closing words to finish playing, then disconnects (running `onCallEnd` on the way out).
 * Keeping the tool inside the single agent means it stays visible/editable in Studio and works on
 * the agent and workflow reply paths alike.
 *
 * ```ts
 * // agent tools
 * endCall: createEndCallTool({
 *   onEndCall: ({ reason, resourceId }) => log.info('agent ended call', { reason, resourceId }),
 * }),
 * // worker
 * createLiveKitWorker({ mastra, agent: 'support', configuration: { endCall: {} } });
 * ```
 */
export function createEndCallTool(options: EndCallToolOptions = {}) {
  return createTool({
    id: options.id ?? 'endCall',
    description: options.description ?? DEFAULT_DESCRIPTION,
    inputSchema: z.object({
      reason: z
        .string()
        .nullish()
        .describe('Short reason the call is ending, e.g. "caller said goodbye" or "task complete".'),
    }),
    outputSchema: z.object({ ended: z.boolean() }),
    execute: async ({ reason }, { agent }) => {
      await options.onEndCall?.({
        reason: reason ?? undefined,
        resourceId: agent?.resourceId,
        threadId: agent?.threadId,
      });
      return { ended: true as const };
    },
  });
}
