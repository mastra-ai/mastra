import type { AssistantContent, ToolResultPart } from 'ai';
import type { MastraMessageV1 } from '../../memory/types';
import type { MastraMessageContentV2, MastraMessageV2 } from '../message-list';
import { attachmentsToParts } from './attachments-to-parts';

export function convertToV1Messages(messages: Array<MastraMessageV2>) {
  const v1Messages: MastraMessageV1[] = [];

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const isLastMessage = i === messages.length - 1;
    if (!message?.content) continue;
    const { content, experimental_attachments, parts } = message.content;
    const { role } = message;
    const fields = {
      id: message.id,
      createdAt: message.createdAt,
      resourceId: message.resourceId!,
      threadId: message.threadId!,
    };

    switch (role) {
      case 'user': {
        if (parts == null) {
          const userContent = experimental_attachments
            ? [{ type: 'text', text: content || '' }, ...attachmentsToParts(experimental_attachments)]
            : { type: 'text', text: content || '' };
          v1Messages.push({
            role: 'user',
            ...fields,
            type: 'text',
            // @ts-ignore
            content: userContent,
            // Array.isArray(userContent) && userContent.length === 1 && userContent[0]?.type === `text`
            //   ? userContent[0].text
            //   : userContent,
          });
          throw new Error(`will we ever hit this code?`);
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
          v1Messages.push({
            role: 'user',
            ...fields,
            type: 'text',
            // content: userContent,
            // @ts-ignore
            content:
              Array.isArray(userContent) &&
              userContent.length === 1 &&
              userContent[0]?.type === `text` &&
              typeof content !== `undefined`
                ? content
                : userContent,
          });
        }
        break;
      }

      case 'assistant': {
        if (message.content.parts != null) {
          let currentStep = 0;
          let blockHasToolInvocations = false;
          let block: MastraMessageContentV2['parts'] = [];

          function processBlock() {
            const content: AssistantContent = [];

            for (const part of block) {
              switch (part.type) {
                case 'file':
                case 'text': {
                  content.push(part);
                  break;
                }
                case 'reasoning': {
                  for (const detail of part.details) {
                    switch (detail.type) {
                      case 'text':
                        content.push({
                          type: 'reasoning' as const,
                          text: detail.text,
                          signature: detail.signature,
                        });
                        break;
                      case 'redacted':
                        content.push({
                          type: 'redacted-reasoning' as const,
                          data: detail.data,
                        });
                        break;
                    }
                  }
                  break;
                }
                case 'tool-invocation':
                  content.push({
                    type: 'tool-call' as const,
                    toolCallId: part.toolInvocation.toolCallId,
                    toolName: part.toolInvocation.toolName,
                    args: part.toolInvocation.args,
                  });
                  break;
              }
            }

            v1Messages.push({
              role: 'assistant',
              ...fields,
              type: content.some(c => c.type === `tool-call`) ? 'tool-call' : 'text',
              // content: content,
              content:
                typeof content !== `string` &&
                Array.isArray(content) &&
                content.length === 1 &&
                content[0]?.type === `text`
                  ? message?.content?.content || content
                  : content,
            });

            // check if there are tool invocations with results in the block
            const stepInvocations = block
              .filter(part => `type` in part && part.type === 'tool-invocation')
              .map(part => part.toolInvocation);

            // tool message with tool results
            if (stepInvocations.length > 0) {
              v1Messages.push({
                role: 'tool',
                ...fields,
                type: 'tool-result',
                // @ts-ignore
                content: stepInvocations.map(toolInvocation => {
                  const { toolCallId, toolName } = toolInvocation;
                  return {
                    type: 'tool-result',
                    toolCallId,
                    toolName,
                    // @ts-ignore
                    result: toolInvocation.result,
                  };
                }),
              });
            }

            // updates for next block
            block = [];
            blockHasToolInvocations = false;
            currentStep++;
          }

          for (const part of message.content.parts) {
            switch (part.type) {
              case 'text': {
                if (blockHasToolInvocations) {
                  processBlock(); // text must come before tool invocations
                }
                block.push(part);
                break;
              }
              case 'file':
              case 'reasoning': {
                block.push(part);
                break;
              }
              case 'tool-invocation': {
                if ((part.toolInvocation.step ?? 0) !== currentStep) {
                  processBlock();
                }
                block.push(part);
                blockHasToolInvocations = true;
                break;
              }
            }
          }

          processBlock();

          break;
        }

        const toolInvocations = message.content.toolInvocations;

        if (toolInvocations == null || toolInvocations.length === 0) {
          v1Messages.push({ role: 'assistant', ...fields, content: content || '', type: 'text' });
          break;
        }

        const maxStep = toolInvocations.reduce((max, toolInvocation) => {
          return Math.max(max, toolInvocation.step ?? 0);
        }, 0);

        for (let i = 0; i <= maxStep; i++) {
          const stepInvocations = toolInvocations.filter(toolInvocation => (toolInvocation.step ?? 0) === i);

          if (stepInvocations.length === 0) {
            continue;
          }

          // assistant message with tool calls
          v1Messages.push({
            role: 'assistant',
            ...fields,
            type: 'tool-call',
            content: [
              ...(isLastMessage && content && i === 0 ? [{ type: 'text' as const, text: content }] : []),
              ...stepInvocations.map(({ toolCallId, toolName, args }) => ({
                type: 'tool-call' as const,
                toolCallId,
                toolName,
                args,
              })),
            ],
          });

          // tool message with tool results
          v1Messages.push({
            role: 'tool',
            ...fields,
            type: 'tool-result',
            content: stepInvocations.map((toolInvocation): ToolResultPart => {
              if (!('result' in toolInvocation)) {
                // @ts-ignore
                return toolInvocation;
              }

              const { toolCallId, toolName, result } = toolInvocation;

              return {
                type: 'tool-result',
                toolCallId,
                toolName,
                result,
              };
            }),
          });
        }

        if (content && !isLastMessage) {
          v1Messages.push({ role: 'assistant', ...fields, type: 'text', content: content || '' });
        }

        break;
      }
    }
  }

  return v1Messages;
}
