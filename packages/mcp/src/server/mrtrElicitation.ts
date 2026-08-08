import type { MCPServerContext } from '@mastra/core/tools';
import type { ElicitRequest, ElicitResult, InputRequiredResult } from '@modelcontextprotocol/server';

import type { ElicitationActions } from './types';

/**
 * Elicitation on the 2026-07-28 protocol revision (multi-round-trip requests).
 *
 * The modern era has no server→client request channel, so `server.elicitInput()`
 * throws there by design. Instead, the `tools/call` handler must RETURN an
 * `input_required` result carrying the embedded elicitation request; the client
 * answers it locally and RETRIES the call with the response attached
 * (`inputResponses`). This module keeps the promise-shaped
 * `elicitation.sendRequest()` API tools already use by replaying the tool:
 *
 * 1. Each `sendRequest` call is assigned a deterministic sequence key.
 * 2. If the current (retried) request carries an answer for that key — either in
 *    this round's `inputResponses` or in the accumulated `requestState` from
 *    prior rounds — the promise resolves with it immediately.
 * 3. Otherwise a {@link ElicitationReplayInterrupt} is thrown; the `tools/call`
 *    handler converts it into an {@link InputRequiredResult} return, and the
 *    client's retry re-executes the tool from the top.
 *
 * Consequences tools must live with on the modern leg:
 * - Code before an unanswered elicitation re-executes on every round; keep side
 *   effects idempotent or place them after the last elicitation.
 * - Elicitation order must be deterministic for a given input, since answers are
 *   matched by call sequence.
 */

const ELICIT_KEY_PREFIX = 'mastra_elicit_';

/**
 * Thrown by the replay-based `sendRequest` when the current round carries no
 * answer for the elicitation. Never surfaces to tools or clients: the
 * `tools/call` handler converts it into an `input_required` result.
 */
export class ElicitationReplayInterrupt extends Error {
  constructor(
    public readonly key: string,
    public readonly params: ElicitRequest['params'],
    public readonly answered: Record<string, ElicitResult>,
  ) {
    super(`Elicitation '${key}' requires client input (multi-round-trip)`);
    this.name = 'ElicitationReplayInterrupt';
  }
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const looksLikeElicitResult = (value: unknown): value is ElicitResult =>
  isPlainObject(value) && typeof value.action === 'string';

/**
 * Decodes the accumulated prior-round answers from the request's opaque
 * `requestState` echo. The state round-trips through the client, so it is
 * attacker-controlled input on re-entry — but its only content is the client's
 * own past elicitation answers, which are untrusted user input either way, so
 * tampering grants the client nothing it does not already control. Anything
 * that does not parse as a map of elicitation results is discarded.
 */
const decodePriorAnswers = (extra: MCPServerContext): Record<string, ElicitResult> => {
  const raw = extra.mcpReq.requestState();
  if (typeof raw !== 'string' || raw.length === 0) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!isPlainObject(parsed)) return {};
    const answers: Record<string, ElicitResult> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (key.startsWith(ELICIT_KEY_PREFIX) && looksLikeElicitResult(value)) answers[key] = value;
    }
    return answers;
  } catch {
    return {};
  }
};

/** This round's bare responses that answer our elicitation keys. */
const currentRoundAnswers = (extra: MCPServerContext): Record<string, ElicitResult> => {
  const answers: Record<string, ElicitResult> = {};
  for (const [key, value] of Object.entries(extra.mcpReq.inputResponses ?? {})) {
    if (key.startsWith(ELICIT_KEY_PREFIX) && looksLikeElicitResult(value)) answers[key] = value;
  }
  return answers;
};

/**
 * Whether this request is served on the 2026-07-28 era. Modern clients always
 * attach the reserved per-request `_meta` envelope (the 2026 codec enforces the
 * required keys at dispatch); legacy requests never carry it.
 */
export const isModernEraRequest = (extra: MCPServerContext): boolean => extra.mcpReq.envelope !== undefined;

/**
 * Builds the replay-based {@link ElicitationActions} for one modern-era tool
 * execution. Answers already provided by the client resolve immediately; the
 * first unanswered elicitation throws {@link ElicitationReplayInterrupt}.
 *
 * The interrupt is also reported through `onInterrupt` before it is thrown:
 * tool wrappers (e.g. Mastra's tool builder) re-wrap thrown errors, so the
 * `tools/call` handler cannot rely on `instanceof` on whatever escapes the
 * tool — the out-of-band capture is the authoritative signal.
 */
export const createReplayElicitation = (
  extra: MCPServerContext,
  onInterrupt: (interrupt: ElicitationReplayInterrupt) => void,
): ElicitationActions => {
  const prior = decodePriorAnswers(extra);
  const current = currentRoundAnswers(extra);
  const answered: Record<string, ElicitResult> = { ...prior, ...current };
  let sequence = 0;

  return {
    sendRequest: async (request: ElicitRequest['params']): Promise<ElicitResult> => {
      const key = `${ELICIT_KEY_PREFIX}${sequence++}`;
      const answer = answered[key];
      if (answer !== undefined) return answer;
      const interrupt = new ElicitationReplayInterrupt(key, request, answered);
      onInterrupt(interrupt);
      throw interrupt;
    },
  };
};

/**
 * Converts a caught {@link ElicitationReplayInterrupt} into the
 * `input_required` result the `tools/call` handler returns to the client.
 * Prior answers travel in `requestState` because each retry only carries the
 * current round's `inputResponses`.
 */
export const replayInterruptToInputRequired = (interrupt: ElicitationReplayInterrupt): InputRequiredResult => {
  const params = { mode: 'form' as const, ...interrupt.params };
  return {
    resultType: 'input_required',
    inputRequests: {
      [interrupt.key]: { method: 'elicitation/create', params } as never,
    },
    ...(Object.keys(interrupt.answered).length > 0 ? { requestState: JSON.stringify(interrupt.answered) } : {}),
  };
};
