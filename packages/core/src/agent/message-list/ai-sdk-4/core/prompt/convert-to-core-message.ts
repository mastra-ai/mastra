import type { FileUIPart, Message, ReasoningUIPart, TextUIPart, ToolInvocationUIPart } from '../../types';
import type { ToolSet } from '../generate-text/tool-set';
import { attachmentsToParts } from './attachments-to-parts';
import type { ToolCallPart, ToolResultPart } from './content-part';
import type { AssistantContent, CoreMessage } from './message';

/**
Converts an array of messages from useChat into an array of CoreMessages that can be used
with the AI core functions (e.g. `streamText`).
 */
export function convertToCoreMessages<TOOLS extends ToolSet = never>(
  messages: Array<Omit<Message, 'id'>>,
  options?: { tools?: TOOLS },
) {
  const tools = options?.tools ?? ({} as TOOLS);
  const coreMessages: CoreMessage[] = [];

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const isLastMessage = i === messages.length - 1;
    const { role, content, experimental_attachments } = message || {};

    switch (role) {
      case 'system': {
        coreMessages.push({
          role: 'system',
          content: content || '',
        });
        break;
      }

      case 'user': {
        if (message?.parts == null) {
          coreMessages.push({
            role: 'user',
            // @ts-ignore
            content: experimental_attachments
              ? [{ type: 'text', text: content }, ...attachmentsToParts(experimental_attachments)]
              : content || '',
          });
        } else {
          const textParts = message.parts
            .filter(part => part.type === 'text')
            .map(part => ({
              type: 'text' as const,
              text: part.text,
            }));

          coreMessages.push({
            role: 'user',
            content: experimental_attachments
              ? [...textParts, ...attachmentsToParts(experimental_attachments)]
              : textParts,
          });
        }
        break;
      }

      case 'assistant': {
        if (message?.parts != null) {
          let currentStep = 0;
          let blockHasToolInvocations = false;
          let block: Array<TextUIPart | ToolInvocationUIPart | ReasoningUIPart | FileUIPart> = [];

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
                default: {
                  const _exhaustiveCheck: never = part;
                  throw new Error(`Unsupported part: ${_exhaustiveCheck}`);
                }
              }
            }

            coreMessages.push({
              role: 'assistant',
              content,
            });

            // check if there are tool invocations with results in the block
            const stepInvocations = block
              .filter(
                (
                  part: TextUIPart | ToolInvocationUIPart | ReasoningUIPart | FileUIPart,
                ): part is ToolInvocationUIPart => part.type === 'tool-invocation',
              )
              .map(part => part.toolInvocation);

            // tool message with tool results
            if (stepInvocations.length > 0) {
              coreMessages.push({
                role: 'tool',
                content: stepInvocations.map((toolInvocation): ToolResultPart => {
                  if (!('result' in toolInvocation)) {
                    throw new Error(
                      `Original error: ${message}.\n${
                        'ToolInvocation must have a result: ' + JSON.stringify(toolInvocation)
                      }`,
                    );
                  }

                  const { toolCallId, toolName, result } = toolInvocation;

                  const tool = tools[toolName];
                  return tool?.experimental_toToolResultContent != null
                    ? {
                        type: 'tool-result',
                        toolCallId,
                        toolName,
                        result: tool.experimental_toToolResultContent(result),
                        experimental_content: tool.experimental_toToolResultContent(result),
                      }
                    : {
                        type: 'tool-result',
                        toolCallId,
                        toolName,
                        result,
                      };
                }),
              });
            }

            // updates for next block
            block = [];
            blockHasToolInvocations = false;
            currentStep++;
          }

          for (const part of message.parts) {
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

        const toolInvocations = message?.toolInvocations;

        if (toolInvocations == null || toolInvocations.length === 0) {
          coreMessages.push({ role: 'assistant', content: content || '' });
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
          coreMessages.push({
            role: 'assistant',
            content: [
              ...(isLastMessage && content && i === 0 ? [{ type: 'text' as const, text: content }] : []),
              ...stepInvocations.map(
                ({ toolCallId, toolName, args }): ToolCallPart => ({
                  type: 'tool-call' as const,
                  toolCallId,
                  toolName,
                  args,
                }),
              ),
            ],
          });

          // tool message with tool results
          coreMessages.push({
            role: 'tool',
            content: stepInvocations.map((toolInvocation): ToolResultPart => {
              if (!('result' in toolInvocation)) {
                throw new Error(
                  `Original error: ${message}.\n${
                    'ToolInvocation must have a result: ' + JSON.stringify(toolInvocation)
                  }`,
                );
              }

              const { toolCallId, toolName, result } = toolInvocation;

              const tool = tools[toolName];
              return tool?.experimental_toToolResultContent != null
                ? {
                    type: 'tool-result',
                    toolCallId,
                    toolName,
                    result: tool.experimental_toToolResultContent(result),
                    experimental_content: tool.experimental_toToolResultContent(result),
                  }
                : {
                    type: 'tool-result',
                    toolCallId,
                    toolName,
                    result,
                  };
            }),
          });
        }

        if (content && !isLastMessage) {
          coreMessages.push({ role: 'assistant', content });
        }

        break;
      }

      case 'data': {
        // ignore
        break;
      }
    }
  }

  return coreMessages;
}
