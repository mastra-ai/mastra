/**
 * This file is an adaptation of https://github.com/vercel/ai/blob/e14c066bf4d02c5ee2180c56a01fa0e5216bc582/packages/ai/core/prompt/convert-to-core-messages.ts
 * But has been modified to work with Mastra storage adapter messages (MastraMessageV1)
 */
import type { MastraMessageV1 } from '../../../memory/types';
import type { MastraMessageContentV2, MastraMessageV2 } from '../../message-list';
import { attachmentsToParts } from './attachments-to-parts';

const makePushOrCombine = (v1Messages: MastraMessageV1[]) => (msg: MastraMessageV1) => {
  const previousMessage = v1Messages.at(-1);
  if (
    msg.role === previousMessage?.role &&
    msg.type === 'text' &&
    previousMessage.type === 'text' &&
    Array.isArray(previousMessage.content) &&
    Array.isArray(msg.content)
  ) {
    for (const part of msg.content) {
      // @ts-ignore needs type gymnastics? msg.content and previousMessage.content are the same type here since both are arrays
      // I'm not sure what's adding `never` to the union but this code definitely works..
      previousMessage.content.push(part);
    }
  } else {
    v1Messages.push(msg);
  }
};
export function convertToV1Messages(messages: Array<MastraMessageV2>) {
  const v1Messages: MastraMessageV1[] = [];
  const pushOrCombine = makePushOrCombine(v1Messages);

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (!message?.content) continue;
    const { content, experimental_attachments: inputAttachments = [], parts: inputParts } = message.content;
    const { role } = message;
    const fields = {
      id: message.id,
      createdAt: message.createdAt,
      resourceId: message.resourceId!,
      threadId: message.threadId!,
    };

    const experimental_attachments = [...inputAttachments];
    const parts: typeof inputParts = [];
    for (const part of inputParts) {
      if (part.type === 'file') {
        experimental_attachments.push({
          url: part.data,
          contentType: part.mimeType,
        });
      } else {
        parts.push(part);
      }
    }

    switch (role) {
      case 'user': {
        if (parts == null) {
          const userContent = experimental_attachments
            ? [{ type: 'text', text: content || '' }, ...attachmentsToParts(experimental_attachments)]
            : { type: 'text', text: content || '' };
          pushOrCombine({
            role: 'user',
            ...fields,
            type: 'text',
            // @ts-ignore
            content: userContent,
          });
        } else {
          const textParts = message.content.parts
            .filter(part => part.type === 'text')
            .map(part => ({
              type: 'text' as const,
              text: part.text,
            }));

          const userContent = experimental_attachments
            ? [...textParts, ...attachmentsToParts(experimental_attachments)]
            : textParts;
          pushOrCombine({
            role: 'user',
            ...fields,
            type: 'text',
            content: userContent,
          });
        }
        break;
      }

      case 'assistant': {
        let partIndex = 0;
        const getFields = () => {
          if (partIndex === 0) {
            partIndex++;
            return fields;
          }
          return { ...fields, id: `${fields.id}_${partIndex++}` };
        };

        // Check if parts contains tool-invocations
        const hasToolInvocationsInParts = message.content.parts?.some(part => part.type === 'tool-invocation') ?? false;

        if (message.content.parts != null && message.content.parts.length > 0) {
          let contentBuffer: MastraMessageContentV2['parts'] = [];

          const flushContentBuffer = () => {
            if (contentBuffer.length > 0) {
              // contentBuffer contains UI parts, not V1 message content
              // We're building V1 message content here
              const v1Content: any[] = [];

              for (const part of contentBuffer) {
                switch (part.type) {
                  case 'text':
                    v1Content.push(part);
                    break;
                  case 'file':
                    v1Content.push(part);
                    break;
                  case 'reasoning':
                    // Convert reasoning parts to V1 format
                    for (const detail of part.details) {
                      if (detail.type === 'text') {
                        v1Content.push({
                          type: 'reasoning' as const,
                          text: detail.text,
                          signature: detail.signature,
                        });
                      } else if (detail.type === 'redacted') {
                        v1Content.push({
                          type: 'redacted-reasoning' as const,
                          data: detail.data,
                        });
                      }
                    }
                    break;
                }
              }

              pushOrCombine({
                role: 'assistant',
                ...getFields(),
                type: 'text',
                content: v1Content,
              });
              contentBuffer = [];
            }
          };

          for (const part of message.content.parts) {
            switch (part.type) {
              case 'text':
              case 'file': {
                contentBuffer.push(part);
                break;
              }
              case 'reasoning': {
                contentBuffer.push(part);
                break;
              }
              case 'tool-invocation': {
                flushContentBuffer();

                if (part.toolInvocation.toolName === 'updateWorkingMemory') continue;

                pushOrCombine({
                  role: 'assistant',
                  ...getFields(),
                  type: 'tool-call',
                  content: [
                    {
                      type: 'tool-call',
                      toolCallId: part.toolInvocation.toolCallId,
                      toolName: part.toolInvocation.toolName,
                      args: part.toolInvocation.args || {},
                    },
                  ],
                });

                if (part.toolInvocation.state === 'result') {
                  pushOrCombine({
                    role: 'tool',
                    ...getFields(),
                    type: 'tool-result',
                    content: [
                      {
                        type: 'tool-result',
                        toolCallId: part.toolInvocation.toolCallId,
                        toolName: part.toolInvocation.toolName,
                        result: part.toolInvocation.result,
                      },
                    ],
                  });
                }
                break;
              }
            }
          }
          flushContentBuffer();
        }

        // Process toolInvocations array if:
        // 1. No parts exist, OR
        // 2. Parts exist but contain no tool-invocations (only text)
        if (
          message.content.toolInvocations &&
          message.content.toolInvocations.length > 0 &&
          !hasToolInvocationsInParts
        ) {
          const toolInvocations = message.content.toolInvocations.filter(ti => ti.toolName !== 'updateWorkingMemory');

          if (toolInvocations.length > 0) {
            const invocationsByStep = new Map<number, typeof toolInvocations>();
            for (const inv of toolInvocations) {
              const step = inv.step ?? 0;
              if (!invocationsByStep.has(step)) {
                invocationsByStep.set(step, []);
              }
              invocationsByStep.get(step)!.push(inv);
            }

            const sortedSteps = Array.from(invocationsByStep.keys()).sort((a, b) => a - b);

            for (const step of sortedSteps) {
              const stepInvocations = invocationsByStep.get(step)!;

              pushOrCombine({
                role: 'assistant',
                ...getFields(),
                type: 'tool-call',
                content: stepInvocations.map(({ toolCallId, toolName, args }) => ({
                  type: 'tool-call' as const,
                  toolCallId,
                  toolName,
                  args: args || {},
                })),
              });

              const invocationsWithResults = stepInvocations.filter(ti => ti.state === 'result' && 'result' in ti);

              if (invocationsWithResults.length > 0) {
                pushOrCombine({
                  role: 'tool',
                  ...getFields(),
                  type: 'tool-result',
                  content: invocationsWithResults.map(({ toolCallId, toolName, result }) => ({
                    type: 'tool-result' as const,
                    toolCallId,
                    toolName,
                    result,
                  })),
                });
              }
            }
          }

          // Only process content if no parts exist (avoid duplication)
          if (content && (!message.content.parts || message.content.parts.length === 0)) {
            pushOrCombine({
              role: 'assistant',
              ...getFields(),
              type: 'text',
              content: content,
            });
          }
        } else if (content && (!message.content.parts || message.content.parts.length === 0)) {
          pushOrCombine({
            role: 'assistant',
            ...getFields(),
            type: 'text',
            content: content,
          });
        }

        break;
      }
    }
  }

  return v1Messages;
}
