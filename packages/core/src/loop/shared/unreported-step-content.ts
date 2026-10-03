import type { MessageList } from '../../agent/message-list';

type ModelContentPart = ReturnType<
  MessageList['get']['response']['aiV5']['modelContentByMessage']
>[number]['content'][number];

/**
 * Returns the response content parts not reported yet and records them in `reportedPartKeys`.
 *
 * Keys are kept per response message id and never deleted. Memory processors (e.g. observational
 * memory) can remove response messages between steps, bring them back, or a tool result can be
 * replaced in place (A -> B -> A); keying by identity instead of position, count, or step-start
 * markers makes all of those report each distinct part exactly once.
 */
export function takeUnreportedStepContent(
  messageList: MessageList,
  reportedPartKeys: Map<string, Set<string>>,
): ModelContentPart[] {
  return messageList.get.response.aiV5.modelContentByMessage().flatMap(({ id, content }) => {
    let reported = reportedPartKeys.get(id);
    if (!reported) {
      reported = new Set();
      reportedPartKeys.set(id, reported);
    }
    const seen = new Map<string, number>();
    return content.filter(part => {
      const identity = getStepPartIdentity(part);
      // Ordinal keeps identical parts within one message distinct.
      const ordinal = seen.get(identity) ?? 0;
      seen.set(identity, ordinal + 1);
      const key = `${identity}#${ordinal}`;
      if (reported.has(key)) return false;
      reported.add(key);
      return true;
    });
  });
}

function getStepPartIdentity(part: object): string {
  // Provider options carry bookkeeping (e.g. createdAt) that changes when a message is re-added,
  // so they are not part of a part's identity.
  const { providerOptions: _providerOptions, ...rest } = part as { providerOptions?: unknown; [key: string]: unknown };
  if (typeof rest.toolCallId === 'string') {
    const result = 'output' in rest ? rest.output : 'result' in rest ? rest.result : rest.input;
    return JSON.stringify([rest.type, rest.toolCallId, result]);
  }
  return JSON.stringify(rest);
}
