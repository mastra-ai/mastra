type ServerHistoryTrigger = 'submit-message' | 'regenerate-message';
const APPROVAL_ID_SEPARATOR = '::';

export type PrepareServerHistoryRequestOptions<UI_MESSAGE extends { id?: string }> = {
  id: string;
  messages: UI_MESSAGE[];
  trigger?: ServerHistoryTrigger;
  messageId?: string;
};

export type ServerHistoryRequestBody<UI_MESSAGE extends { id?: string }> =
  | {
      id: string;
      trigger: 'submit-message';
      message: UI_MESSAGE;
    }
  | {
      id: string;
      trigger: 'regenerate-message';
      messageId: string;
    }
  | {
      id: string;
      runId: string;
      resumeData: Record<string, unknown>;
      messageId?: string;
    };

function extractApprovalResume(messages: Array<{ id?: string; role?: string; parts?: unknown[] }>) {
  const lastMessage = messages.at(-1);
  if (!lastMessage || lastMessage.role !== 'assistant') return null;

  for (const part of lastMessage.parts ?? []) {
    if (!part || typeof part !== 'object') continue;
    const maybePart = part as {
      state?: unknown;
      approval?: {
        id?: unknown;
        approved?: unknown;
        reason?: unknown;
      };
    };
    if (maybePart.state !== 'approval-responded' || typeof maybePart.approval?.id !== 'string') continue;

    const lastSep = maybePart.approval.id.lastIndexOf(APPROVAL_ID_SEPARATOR);
    if (lastSep === -1) continue;
    const runId = maybePart.approval.id.slice(0, lastSep);
    if (!runId) continue;

    return {
      runId,
      resumeData: {
        approved: maybePart.approval.approved,
        ...(maybePart.approval.reason != null ? { reason: maybePart.approval.reason } : {}),
      },
      ...(lastMessage.id ? { messageId: lastMessage.id } : {}),
    };
  }

  return null;
}

export function prepareServerHistoryRequest<UI_MESSAGE extends { id?: string }>() {
  return ({
    id,
    messages,
    trigger = 'submit-message',
    messageId,
  }: PrepareServerHistoryRequestOptions<UI_MESSAGE>): { body: ServerHistoryRequestBody<UI_MESSAGE> } => {
    const approvalResume = extractApprovalResume(messages);
    if (approvalResume) {
      return {
        body: {
          id,
          ...approvalResume,
        },
      };
    }

    if (trigger === 'regenerate-message') {
      const targetMessageId = messageId ?? messages.at(-1)?.id;
      if (!targetMessageId) {
        throw new Error('messageId is required when regenerating with server history');
      }

      return {
        body: {
          id,
          trigger,
          messageId: targetMessageId,
        },
      };
    }

    const message = messages.at(-1);
    if (!message) {
      throw new Error('A message is required when submitting with server history');
    }

    return {
      body: {
        id,
        trigger,
        message,
      },
    };
  };
}
