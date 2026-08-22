/**
 * Every buffered step of a run carries the response messages of the run *so
 * far*, three times over: `response.messages` (the model-format messages),
 * `response.dbMessages` and `response.uiMessages` are all cumulative snapshots
 * of the same growing conversation, not per-step deltas. Persisting them on
 * every step makes a suspended snapshot grow quadratically in step count: a
 * fifteen-iteration agent run has been observed writing 22 MB of buffered steps
 * over 2 MB of distinct messages.
 *
 * The full conversation is already persisted once, in the serialized
 * `messageList` that sits alongside the buffered steps. So the snapshot stores
 * only how many response messages existed when each step finished, and rebuilds
 * all three mirrors from that list on the way back in. This is safe because
 * `messageList.get.response.db()` is append-only — it filters the run's
 * messages down to the response ones in order, so its value at step `i` is
 * exactly the first `n` entries of its value now.
 *
 * One behavioural note. A step's `dbMessages` share message objects with the
 * list, and an agentic turn keeps appending parts to the same message, so the
 * mirror a step persisted was never its step-time snapshot to begin with — it
 * was whatever the message had grown into by the time the snapshot was
 * written. `uiMessages` and `messages` were copies and did hold the step-time
 * shape, so after rehydration an earlier step's mirrors now reflect the same
 * content its `dbMessages` always did. The steps stay internally consistent,
 * and the last step — the one a resume continues from — is unchanged.
 *
 * The same pass drops `request.body`, which holds a copy of the prompt and the
 * tool catalog per step. Nothing reads a buffered step's request back on
 * resume (the next request is rebuilt from the message list), and the terminal
 * step history is already pruned the same way — see `pruneStepResult` in
 * `workflows/prune-snapshot`.
 *
 * All of this is purely a storage representation: callers still see populated
 * message mirrors on every step after rehydration.
 */

import type { AIV5Type, MastraDBMessage, MessageList } from '../../agent/message-list';
import { convertMessages } from '../../agent/message-list';

const RESPONSE_MESSAGE_COUNT = '__responseMessageCount' as const;

type ResponseLike = {
  dbMessages?: unknown;
  uiMessages?: unknown;
  [RESPONSE_MESSAGE_COUNT]?: number;
};

type StepLike = { response?: unknown; request?: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function packStepMessageMirrors<T extends StepLike>(steps: T[]): T[] {
  if (!Array.isArray(steps)) return steps;

  return steps.map(step => {
    if (!isRecord(step)) return step;

    let next: Record<string, unknown> | undefined;

    if (isRecord(step.response) && Array.isArray((step.response as ResponseLike).dbMessages)) {
      const {
        dbMessages,
        uiMessages: _uiMessages,
        messages: _messages,
        ...restResponse
      } = step.response as Record<string, unknown>;
      next = {
        ...step,
        response: { ...restResponse, [RESPONSE_MESSAGE_COUNT]: (dbMessages as unknown[]).length },
      };
    }

    // The prompt and tool catalog are reconstructed on resume, so a persisted
    // copy per step is pure weight.
    if (isRecord(step.request) && 'body' in step.request) {
      const { body: _body, ...restRequest } = step.request;
      next = { ...(next ?? step), request: restRequest };
    }

    return (next ?? step) as T;
  });
}

export function unpackStepMessageMirrors<T extends StepLike>(steps: T[], messageList: MessageList): T[] {
  if (!Array.isArray(steps)) return steps;

  // Snapshots written before this change carry the mirrors inline and need no
  // rehydration — do not pay for the message list read in that case.
  const needsRehydration = steps.some(
    step => isRecord(step) && isRecord(step.response) && RESPONSE_MESSAGE_COUNT in step.response,
  );
  if (!needsRehydration) return steps;

  let responseMessages: MastraDBMessage[] | undefined;

  return steps.map(step => {
    if (!isRecord(step) || !isRecord(step.response) || !(RESPONSE_MESSAGE_COUNT in step.response)) return step;

    const { [RESPONSE_MESSAGE_COUNT]: count, ...restResponse } = step.response as ResponseLike &
      Record<string, unknown>;

    responseMessages ??= messageList.get.response.db();
    const dbMessages = responseMessages.slice(0, count as number);

    return {
      ...step,
      response: {
        ...restResponse,
        dbMessages,
        // Converting the slice — rather than slicing a conversion of the whole
        // run — is what makes this faithful: the conversions merge adjacent
        // assistant messages, so later messages can change how earlier ones
        // render.
        uiMessages: convertMessages(dbMessages).to('AIV5.UI') as AIV5Type.UIMessage[],
        // `messages` is the model-format view of the same response messages —
        // `messageList.get.response.aiV5.model()` at the time the step finished.
        messages: convertMessages(dbMessages).to('AIV5.Model'),
      },
    } as unknown as T;
  });
}
