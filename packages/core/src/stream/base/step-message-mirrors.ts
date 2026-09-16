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
 * only the stable IDs of the messages each step referenced, and rebuilds the
 * three mirrors lazily from that list on the way back in. IDs are used instead
 * of a prefix length because processors can promote messages between sources or
 * remove messages after an earlier step was buffered.
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
 * This is purely a storage representation: callers still see populated message
 * mirrors on every step after rehydration. Each mirror is rebuilt and cached
 * only if a caller reads it, so restoring a long run does not eagerly convert
 * every historical prefix.
 */

import type { AIV5Type, MastraDBMessage, MessageList } from '../../agent/message-list';
import { convertMessages } from '../../agent/message-list';

const RESPONSE_MESSAGE_IDS = '__responseMessageIds' as const;

type ResponseLike = {
  dbMessages?: unknown;
  uiMessages?: unknown;
  messages?: unknown;
  [RESPONSE_MESSAGE_IDS]?: string[];
};

type StepLike = { response?: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function withoutMessageMirrors(response: Record<string, unknown>): Record<string, unknown> {
  const rest: Record<string, unknown> = {};
  for (const key of Object.keys(response)) {
    if (key === 'dbMessages' || key === 'uiMessages' || key === 'messages' || key === RESPONSE_MESSAGE_IDS) continue;
    rest[key] = response[key];
  }
  return rest;
}

export function packStepMessageMirrors<T extends StepLike>(steps: T[]): T[] {
  if (!Array.isArray(steps)) return steps;

  return steps.map(step => {
    if (!isRecord(step) || !isRecord(step.response) || !Array.isArray((step.response as ResponseLike).dbMessages)) {
      return step;
    }

    const dbMessages = (step.response as ResponseLike).dbMessages as MastraDBMessage[];
    return {
      ...step,
      response: {
        ...withoutMessageMirrors(step.response),
        [RESPONSE_MESSAGE_IDS]: dbMessages.map(message => message.id),
      },
    } as T;
  });
}

export function unpackStepMessageMirrors<T extends StepLike>(steps: T[], messageList: MessageList): T[] {
  if (!Array.isArray(steps)) return steps;

  // Snapshots written before this change carry the mirrors inline and need no
  // rehydration — do not pay for the message list read in that case.
  const needsRehydration = steps.some(
    step => isRecord(step) && isRecord(step.response) && RESPONSE_MESSAGE_IDS in step.response,
  );
  if (!needsRehydration) return steps;

  let messagesById: Map<string, MastraDBMessage> | undefined;

  return steps.map(step => {
    if (!isRecord(step) || !isRecord(step.response) || !(RESPONSE_MESSAGE_IDS in step.response)) return step;

    const messageIds = (step.response as ResponseLike)[RESPONSE_MESSAGE_IDS] as string[];
    const response = withoutMessageMirrors(step.response);
    let dbMessages: MastraDBMessage[] | undefined;
    let uiMessages: AIV5Type.UIMessage[] | undefined;
    let messages: unknown;

    const getDbMessages = () => {
      if (!dbMessages) {
        messagesById ??= new Map(messageList.get.all.db().map(message => [message.id, message]));
        dbMessages = messageIds.flatMap(id => {
          const message = messagesById!.get(id);
          return message ? [message] : [];
        });
      }
      return dbMessages;
    };

    Object.defineProperties(response, {
      dbMessages: {
        enumerable: true,
        get: getDbMessages,
      },
      uiMessages: {
        enumerable: true,
        get() {
          // Converting this step's messages — rather than slicing a conversion
          // of the whole run — is what makes this faithful: conversions merge
          // adjacent assistant messages, so later messages can change how
          // earlier ones render.
          return (uiMessages ??= convertMessages(getDbMessages()).to('AIV5.UI') as AIV5Type.UIMessage[]);
        },
      },
      messages: {
        enumerable: true,
        get() {
          // The model-format view of the same response messages that existed
          // when the step finished.
          return (messages ??= convertMessages(getDbMessages()).to('AIV5.Model'));
        },
      },
    });

    return { ...step, response } as unknown as T;
  });
}
