import * as AIV5 from '@internal/ai-sdk-v5';
import * as AIV6 from '@internal/ai-v6';

import type {
  MastraDBMessage,
  MastraMessagePart,
  MastraProviderMetadata,
  MastraToolApproval,
  MastraToolInvocation,
  MastraToolInvocationPart,
} from '../state/types';
import type { AIV5Type, AIV6Type, MessageSource } from '../types';
import { sanitizeToolName } from '../utils/tool-name';
import { AIV5Adapter } from './AIV5Adapter';

type AIV6AdapterContext = {
  dbMessages?: MastraDBMessage[];
};

function withOptionalFields<T extends Record<string, unknown>, U extends Record<string, unknown>>(
  target: T,
  fields: U,
): T & Partial<U> {
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      (target as Record<string, unknown>)[key] = value;
    }
  }
  return target as T & Partial<U>;
}

function getToolNameFromType(type: string): string {
  return type.startsWith('tool-') ? sanitizeToolName(type.slice('tool-'.length)) : sanitizeToolName(type);
}

function normalizeToolArgs(input: unknown): Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
}

function isV6OnlyToolState(
  state: string,
): state is Extract<MastraToolInvocation['state'], 'approval-requested' | 'approval-responded' | 'output-denied'> {
  return state === 'approval-requested' || state === 'approval-responded' || state === 'output-denied';
}

function toMastraApproval(
  approval: AIV6Type.UIToolInvocation<AIV6Type.UITool>['approval'],
): MastraToolApproval | undefined {
  if (!approval) return undefined;

  return {
    id: approval.id,
    approved: 'approved' in approval ? approval.approved : undefined,
    reason: 'reason' in approval ? approval.reason : undefined,
  };
}

function toMastraProviderMetadata(
  providerMetadata: AIV6Type.ProviderMetadata | undefined,
): MastraProviderMetadata | undefined {
  return providerMetadata as MastraProviderMetadata | undefined;
}

function getToolNameFromUIPart(part: AIV6Type.ToolUIPart | AIV6Type.DynamicToolUIPart): string {
  return part.type === 'dynamic-tool' ? sanitizeToolName(part.toolName) : getToolNameFromType(part.type);
}

function normalizeV6PartForV5Bridge(part: AIV6Type.UIMessage['parts'][number]): AIV5Type.UIMessage['parts'][number] {
  if (part.type === 'dynamic-tool' && !isV6OnlyToolState(part.state)) {
    return {
      ...part,
      type: `tool-${sanitizeToolName(part.toolName)}`,
    } as unknown as AIV5Type.UIMessage['parts'][number];
  }

  return part as unknown as AIV5Type.UIMessage['parts'][number];
}

function createToolInvocationPart({
  toolCallId,
  toolName,
  args,
  state,
  approval,
  result,
  errorText,
  rawInput,
  providerMetadata,
  providerExecuted,
  title,
  preliminary,
}: {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  state: MastraToolInvocation['state'];
  approval?: MastraToolApproval;
  result?: unknown;
  errorText?: string;
  rawInput?: unknown;
  providerMetadata?: MastraToolInvocationPart['providerMetadata'];
  providerExecuted?: boolean;
  title?: string;
  preliminary?: boolean;
}): MastraToolInvocationPart {
  return withOptionalFields(
    {
      type: 'tool-invocation',
      toolInvocation: withOptionalFields(
        {
          toolCallId,
          toolName,
          args,
          state,
        },
        {
          approval,
          result,
          errorText,
          rawInput,
        },
      ),
    } satisfies MastraToolInvocationPart,
    {
      providerMetadata,
      providerExecuted,
      title,
      preliminary,
    },
  );
}

function findToolInvocationPart(parts: MastraMessagePart[], toolCallId: string): MastraToolInvocationPart | undefined {
  for (const part of parts) {
    if (part.type === 'tool-invocation' && part.toolInvocation.toolCallId === toolCallId) {
      return part;
    }
  }

  return undefined;
}

function findApprovalRequest(
  dbMessages: MastraDBMessage[] | undefined,
  approvalId: string,
): MastraToolInvocationPart | undefined {
  if (!dbMessages) return undefined;

  for (const message of [...dbMessages].reverse()) {
    for (const part of [...(message.content.parts || [])].reverse()) {
      if (
        part.type === 'tool-invocation' &&
        part.toolInvocation.approval?.id === approvalId &&
        part.toolInvocation.state === 'approval-requested'
      ) {
        return part;
      }
    }
  }

  return undefined;
}

/**
 * AIV6Adapter - Handles conversions between MastraDBMessage and AI SDK v6 formats.
 */
export class AIV6Adapter {
  static toUIMessage(dbMsg: MastraDBMessage): AIV6Type.UIMessage {
    const v5Message = AIV5Adapter.toUIMessage(dbMsg);
    const metadata = (v5Message.metadata || {}) as Record<string, unknown>;
    const parts: AIV6Type.UIMessage['parts'] = [];

    if (dbMsg.role === 'signal' && v5Message.role !== 'user') {
      return {
        id: dbMsg.id,
        role: 'system',
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        parts: v5Message.parts.map(part => AIV6Adapter.toUIPartFromV5(part)),
      };
    }

    const dbParts = dbMsg.content.parts || [];
    const hasToolInvocationParts = dbParts.some(part => part.type === 'tool-invocation');
    const hasReasoningParts = dbParts.some(part => part.type === 'reasoning');
    const hasFileParts = dbParts.some(part => part.type === 'file');
    const hasTextParts = dbParts.some(part => part.type === 'text');

    for (const part of dbParts) {
      parts.push(AIV6Adapter.toUIPart(part));
    }

    if (!hasToolInvocationParts || !hasReasoningParts || !hasFileParts || !hasTextParts) {
      for (const part of v5Message.parts) {
        if (AIV5.isToolUIPart(part)) {
          if (!hasToolInvocationParts) {
            parts.push(AIV6Adapter.toUIPartFromV5(part));
          }
          continue;
        }

        if (part.type === 'reasoning') {
          if (!hasReasoningParts) {
            parts.push(AIV6Adapter.toUIPartFromV5(part));
          }
          continue;
        }

        if (part.type === 'file') {
          if (!hasFileParts) {
            parts.push(AIV6Adapter.toUIPartFromV5(part));
          }
          continue;
        }

        if (part.type === 'text' && !hasTextParts) {
          parts.push(AIV6Adapter.toUIPartFromV5(part));
        }
      }
    }

    return {
      id: dbMsg.id,
      role: dbMsg.role === 'signal' ? v5Message.role : dbMsg.role,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      parts,
    };
  }

  static fromUIMessage(uiMsg: AIV6Type.UIMessage): MastraDBMessage {
    const compatibleParts = uiMsg.parts.filter(part => {
      if (part.type === 'source-document') return false;
      if (AIV6.isToolUIPart(part) && isV6OnlyToolState(part.state)) return false;
      return true;
    });

    const baseDb = AIV5Adapter.fromUIMessage({
      ...uiMsg,
      parts: compatibleParts.map(part => normalizeV6PartForV5Bridge(part)) as AIV5Type.UIMessage['parts'],
    } as AIV5Type.UIMessage);

    const baseParts = baseDb.content.parts || [];
    const parts: MastraMessagePart[] = [];
    let basePartIndex = 0;

    for (const part of uiMsg.parts) {
      if (part.type === 'source-document') {
        parts.push(
          withOptionalFields(
            {
              type: 'source-document',
              sourceId: part.sourceId,
              mediaType: part.mediaType,
              title: part.title,
            },
            {
              filename: part.filename,
              providerMetadata: toMastraProviderMetadata(part.providerMetadata),
            },
          ) as MastraMessagePart,
        );
        continue;
      }

      if (!AIV6.isToolUIPart(part) || !isV6OnlyToolState(part.state)) {
        const basePart = baseParts[basePartIndex++];
        if (basePart) {
          parts.push(basePart);
        }
        continue;
      }

      parts.push(
        createToolInvocationPart({
          toolCallId: part.toolCallId,
          toolName: getToolNameFromUIPart(part),
          args: normalizeToolArgs(part.input),
          state: part.state,
          approval: toMastraApproval(part.approval),
          providerMetadata:
            'callProviderMetadata' in part ? toMastraProviderMetadata(part.callProviderMetadata) : undefined,
          providerExecuted: part.providerExecuted,
          title: part.title,
          preliminary: 'preliminary' in part ? part.preliminary : undefined,
        }),
      );
    }

    return {
      ...baseDb,
      content: {
        ...baseDb.content,
        parts,
      },
    };
  }

  static fromModelMessage(
    modelMsg: AIV6Type.ModelMessage,
    _messageSource?: MessageSource,
    context: AIV6AdapterContext = {},
  ): MastraDBMessage {
    const content = Array.isArray(modelMsg.content)
      ? modelMsg.content
      : [{ type: 'text', text: modelMsg.content } satisfies AIV6Type.TextPart];

    const compatibleContent = content.filter(
      part => part.type !== 'tool-approval-request' && part.type !== 'tool-approval-response',
    );

    const baseDb = AIV5Adapter.fromModelMessage(
      {
        ...modelMsg,
        content: compatibleContent as unknown as AIV5Type.ModelMessage['content'],
      } as AIV5Type.ModelMessage,
      _messageSource,
    );

    const parts = [...baseDb.content.parts];

    if (modelMsg.role === 'assistant') {
      const toolCalls = new Map<
        string,
        {
          toolName: string;
          args: Record<string, unknown>;
        }
      >();

      for (const part of content) {
        if (part.type === 'tool-call') {
          toolCalls.set(part.toolCallId, {
            toolName: sanitizeToolName(part.toolName),
            args: normalizeToolArgs(part.input),
          });
          continue;
        }

        if (part.type !== 'tool-approval-request') {
          continue;
        }

        const call = toolCalls.get(part.toolCallId);
        const existingPart = findToolInvocationPart(parts, part.toolCallId);

        if (existingPart) {
          existingPart.toolInvocation.state = 'approval-requested';
          existingPart.toolInvocation.approval = { id: part.approvalId };
          continue;
        }

        parts.push(
          createToolInvocationPart({
            toolCallId: part.toolCallId,
            toolName: call?.toolName || 'unknown',
            args: call?.args || {},
            state: 'approval-requested',
            approval: { id: part.approvalId },
          }),
        );
      }
    } else if (modelMsg.role === 'tool') {
      for (const part of content) {
        if (part.type !== 'tool-approval-response') {
          continue;
        }

        const request = findApprovalRequest(context.dbMessages, part.approvalId);
        if (!request) {
          continue;
        }

        parts.push(
          createToolInvocationPart({
            toolCallId: request.toolInvocation.toolCallId,
            toolName: request.toolInvocation.toolName,
            args: request.toolInvocation.args,
            state: 'approval-responded',
            approval: {
              id: part.approvalId,
              approved: part.approved,
              reason: part.reason,
            },
            providerMetadata: request.providerMetadata,
            providerExecuted: request.providerExecuted,
            title: request.title,
          }),
        );
      }
    }

    return {
      ...baseDb,
      content: {
        ...baseDb.content,
        parts,
      },
    };
  }

  private static toUIPart(part: MastraMessagePart): AIV6Type.UIMessage['parts'][number] {
    if (part.type === 'tool-invocation') {
      const base = withOptionalFields(
        {
          type: `tool-${sanitizeToolName(part.toolInvocation.toolName)}`,
          toolCallId: part.toolInvocation.toolCallId,
          providerExecuted: part.providerExecuted,
        },
        {
          callProviderMetadata: part.providerMetadata,
          title: part.title,
        },
      );

      switch (part.toolInvocation.state) {
        case 'partial-call':
          return {
            ...base,
            state: 'input-streaming',
            input: part.toolInvocation.args,
          } as AIV6Type.UIMessage['parts'][number];

        case 'call':
          return {
            ...base,
            state: 'input-available',
            input: part.toolInvocation.args,
          } as AIV6Type.UIMessage['parts'][number];

        case 'approval-requested':
          return {
            ...base,
            state: 'approval-requested',
            input: part.toolInvocation.args,
            approval: {
              id: part.toolInvocation.approval?.id || part.toolInvocation.toolCallId,
            },
          } as AIV6Type.UIMessage['parts'][number];

        case 'approval-responded':
          return {
            ...base,
            state: 'approval-responded',
            input: part.toolInvocation.args,
            approval: {
              id: part.toolInvocation.approval?.id || part.toolInvocation.toolCallId,
              approved: part.toolInvocation.approval?.approved ?? false,
              reason: part.toolInvocation.approval?.reason,
            },
          } as AIV6Type.UIMessage['parts'][number];

        case 'output-error':
          return withOptionalFields(
            {
              ...base,
              state: 'output-error',
              input: part.toolInvocation.args,
              errorText: part.toolInvocation.errorText || '',
            },
            {
              rawInput: part.toolInvocation.rawInput,
              approval:
                part.toolInvocation.approval?.approved === true
                  ? {
                      id: part.toolInvocation.approval.id,
                      approved: true,
                      reason: part.toolInvocation.approval.reason,
                    }
                  : undefined,
            },
          ) as AIV6Type.UIMessage['parts'][number];

        case 'output-denied':
          return {
            ...base,
            state: 'output-denied',
            input: part.toolInvocation.args,
            approval: {
              id: part.toolInvocation.approval?.id || part.toolInvocation.toolCallId,
              approved: false,
              reason: part.toolInvocation.approval?.reason,
            },
          } as AIV6Type.UIMessage['parts'][number];

        case 'result':
          return withOptionalFields(
            {
              ...base,
              state: 'output-available',
              input: part.toolInvocation.args,
              output: part.toolInvocation.result,
            },
            {
              preliminary: part.preliminary,
              approval:
                part.toolInvocation.approval?.approved === true
                  ? {
                      id: part.toolInvocation.approval.id,
                      approved: true,
                      reason: part.toolInvocation.approval.reason,
                    }
                  : undefined,
            },
          ) as AIV6Type.UIMessage['parts'][number];

        default:
          throw new Error(`Unhandled toolInvocation.state: ${String(part.toolInvocation.state)}`);
      }
    }

    if (part.type === 'source-document') {
      return withOptionalFields(
        {
          type: 'source-document',
          sourceId: part.sourceId,
          mediaType: part.mediaType,
          title: part.title,
        },
        {
          filename: part.filename,
          providerMetadata: part.providerMetadata,
        },
      ) as AIV6Type.UIMessage['parts'][number];
    }

    return AIV6Adapter.toUIPartFromV5(
      AIV5Adapter.toUIMessage({
        id: 'tmp',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [part],
        },
      }).parts[0]!,
    );
  }

  private static toUIPartFromV5(part: AIV5Type.UIMessage['parts'][number]): AIV6Type.UIMessage['parts'][number] {
    if (AIV5.isToolUIPart(part)) {
      const base = {
        type: part.type,
        toolCallId: part.toolCallId,
        providerExecuted: part.providerExecuted,
      };

      switch (part.state) {
        case 'input-streaming':
          return withOptionalFields(
            {
              ...base,
              state: 'input-streaming',
              input: part.input,
            },
            {
              callProviderMetadata: 'callProviderMetadata' in part ? part.callProviderMetadata : undefined,
              title: 'title' in part ? part.title : undefined,
            },
          ) as AIV6Type.UIMessage['parts'][number];

        case 'input-available':
          return withOptionalFields(
            {
              ...base,
              state: 'input-available',
              input: part.input,
            },
            {
              callProviderMetadata: 'callProviderMetadata' in part ? part.callProviderMetadata : undefined,
              title: 'title' in part ? part.title : undefined,
            },
          ) as AIV6Type.UIMessage['parts'][number];

        case 'output-available':
          return withOptionalFields(
            {
              ...base,
              state: 'output-available',
              input: part.input,
              output: part.output,
            },
            {
              callProviderMetadata: 'callProviderMetadata' in part ? part.callProviderMetadata : undefined,
              preliminary: 'preliminary' in part ? part.preliminary : undefined,
              title: 'title' in part ? part.title : undefined,
            },
          ) as AIV6Type.UIMessage['parts'][number];

        case 'output-error':
          return withOptionalFields(
            {
              ...base,
              state: 'output-error',
              input: part.input,
              errorText: part.errorText,
            },
            {
              rawInput: 'rawInput' in part ? part.rawInput : undefined,
              callProviderMetadata: 'callProviderMetadata' in part ? part.callProviderMetadata : undefined,
              title: 'title' in part ? part.title : undefined,
            },
          ) as AIV6Type.UIMessage['parts'][number];
      }
    }

    switch (part.type) {
      case 'text':
        return withOptionalFields(
          { type: 'text', text: part.text },
          { providerMetadata: part.providerMetadata },
        ) as AIV6Type.UIMessage['parts'][number];

      case 'reasoning':
        return withOptionalFields(
          {
            type: 'reasoning',
            text: part.text,
            state: part.state,
          },
          { providerMetadata: part.providerMetadata },
        ) as AIV6Type.UIMessage['parts'][number];

      case 'file':
        return withOptionalFields(
          {
            type: 'file',
            url: part.url,
            mediaType: part.mediaType,
          },
          {
            filename: 'filename' in part ? part.filename : undefined,
            providerMetadata: part.providerMetadata,
          },
        ) as AIV6Type.UIMessage['parts'][number];

      case 'source-url':
        return withOptionalFields(
          {
            type: 'source-url',
            sourceId: part.sourceId,
            url: part.url,
          },
          { title: part.title, providerMetadata: part.providerMetadata },
        ) as AIV6Type.UIMessage['parts'][number];

      case 'step-start':
        return { type: 'step-start' };

      default:
        if (typeof part.type === 'string' && part.type.startsWith('data-')) {
          return {
            type: part.type,
            data: 'data' in part ? part.data : undefined,
          } as AIV6Type.UIMessage['parts'][number];
        }

        return part as unknown as AIV6Type.UIMessage['parts'][number];
    }
  }
}
