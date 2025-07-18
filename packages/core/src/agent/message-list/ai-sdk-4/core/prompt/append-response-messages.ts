import type * as AIV4 from '../../';
import type { ResponseMessage } from '../generate-text/step-result';
import { convertDataContentToBase64String } from './data-content';

export function extractMaxToolInvocationStep(toolInvocations: AIV4.ToolInvocation[] | undefined): number | undefined {
  return toolInvocations?.reduce((max, toolInvocation) => {
    return Math.max(max, toolInvocation.step ?? 0);
  }, 0);
}

/**
 * Appends the ResponseMessage[] from the response to a Message[] (for useChat).
 * The messages are converted to Messages before being appended.
 * Timestamps are generated for the new messages.
 *
 * @returns A new Message[] with the response messages appended.
 */
export function appendResponseMessages({
  messages,
  responseMessages,
  _internal: { currentDate = () => new Date() } = {},
}: {
  messages: AIV4.Message[];
  responseMessages: ResponseMessage[];

  /**
Internal. For test use only. May change without notice.
     */
  _internal?: {
    currentDate?: () => Date;
  };
}): AIV4.Message[] {
  const clonedMessages = structuredClone(messages);

  for (const message of responseMessages) {
    const role = message.role;

    // check if the last message is an assistant message:
    const lastMessage = clonedMessages[clonedMessages.length - 1];
    const isLastMessageAssistant = lastMessage?.role === 'assistant';

    switch (role) {
      case 'assistant': {
        function getToolInvocations(step: number) {
          return (
            typeof message.content === 'string' ? [] : message.content.filter(part => part.type === 'tool-call')
          ).map(call => ({
            state: 'call' as const,
            step,
            args: call.args,
            toolCallId: call.toolCallId,
            toolName: call.toolName,
          }));
        }

        const parts: Array<
          AIV4.TextUIPart | AIV4.ReasoningUIPart | AIV4.ToolInvocationUIPart | AIV4.FileUIPart | AIV4.StepStartUIPart
        > = [{ type: 'step-start' as const }]; // always start with a step-start part
        let textContent = '';
        let reasoningTextContent = undefined;

        if (typeof message.content === 'string') {
          textContent = message.content;
          parts.push({
            type: 'text' as const,
            text: message.content,
          });
        } else {
          let reasoningPart: AIV4.ReasoningUIPart | undefined = undefined;
          for (const part of message.content) {
            switch (part.type) {
              case 'text': {
                reasoningPart = undefined; // reset the reasoning part

                textContent += part.text;
                parts.push({
                  type: 'text' as const,
                  text: part.text,
                });
                break;
              }
              case 'reasoning': {
                if (reasoningPart == null) {
                  reasoningPart = {
                    type: 'reasoning' as const,
                    reasoning: '',
                    details: [],
                  };
                  parts.push(reasoningPart);
                }

                reasoningTextContent = (reasoningTextContent ?? '') + part.text;
                reasoningPart.reasoning += part.text;
                reasoningPart.details.push({
                  type: 'text' as const,
                  text: part.text,
                  signature: part.signature,
                });
                break;
              }
              case 'redacted-reasoning': {
                if (reasoningPart == null) {
                  reasoningPart = {
                    type: 'reasoning' as const,
                    reasoning: '',
                    details: [],
                  };
                  parts.push(reasoningPart);
                }

                reasoningPart.details.push({
                  type: 'redacted' as const,
                  data: part.data,
                });
                break;
              }
              case 'tool-call':
                break;
              case 'file':
                if (part.data instanceof URL) {
                  throw new Error(`InvalidAssistantFileData: File data cannot be a URL`);
                }
                parts.push({
                  type: 'file' as const,
                  mimeType: part.mimeType,
                  data: convertDataContentToBase64String(part.data),
                });
                break;
            }
          }
        }

        if (isLastMessageAssistant) {
          const maxStep = extractMaxToolInvocationStep(lastMessage.toolInvocations);

          lastMessage.parts ??= [];

          lastMessage.content = textContent;
          lastMessage.reasoning = reasoningTextContent;
          lastMessage.parts.push(...parts);

          lastMessage.toolInvocations = [
            ...(lastMessage.toolInvocations ?? []),
            ...getToolInvocations(maxStep === undefined ? 0 : maxStep + 1),
          ];

          getToolInvocations(maxStep === undefined ? 0 : maxStep + 1)
            .map(call => ({
              type: 'tool-invocation' as const,
              toolInvocation: call,
            }))
            .forEach(part => {
              lastMessage.parts!.push(part);
            });
        } else {
          // last message was a user message, add the assistant message:
          clonedMessages.push({
            role: 'assistant',
            id: message.id,
            createdAt: currentDate(), // generate a createdAt date for the message, will be overridden by the client
            content: textContent,
            reasoning: reasoningTextContent,
            toolInvocations: getToolInvocations(0),
            parts: [
              ...parts,
              ...getToolInvocations(0).map(call => ({
                type: 'tool-invocation' as const,
                toolInvocation: call,
              })),
            ],
          });
        }

        break;
      }

      case 'tool': {
        // for tool call results, add the result to previous message:
        if (lastMessage) lastMessage.toolInvocations ??= []; // ensure the toolInvocations array exists

        if (lastMessage?.role !== 'assistant') {
          throw new Error(`Tool result must follow an assistant message: ${lastMessage?.role}`);
        }

        lastMessage.parts ??= [];

        for (const contentPart of message.content) {
          // find the tool call in the previous message:
          const toolCall = lastMessage?.toolInvocations?.find(call => call.toolCallId === contentPart.toolCallId);
          const toolCallPart: AIV4.ToolInvocationUIPart | undefined = lastMessage.parts.find(
            (part): part is AIV4.ToolInvocationUIPart =>
              part.type === 'tool-invocation' && part.toolInvocation.toolCallId === contentPart.toolCallId,
          );

          if (!toolCall) {
            throw new Error('Tool call not found in previous message');
          }

          // add the result to the tool call:
          toolCall.state = 'result';
          const toolResult = toolCall as AIV4.ToolInvocation & { state: 'result' };
          toolResult.result = contentPart.result;

          if (toolCallPart) {
            toolCallPart.toolInvocation = toolResult;
          } else {
            lastMessage.parts.push({
              type: 'tool-invocation' as const,
              toolInvocation: toolResult,
            });
          }
        }

        break;
      }

      default: {
        const _exhaustiveCheck: never = role;
        throw new Error(`Unsupported message role: ${_exhaustiveCheck}`);
      }
    }
  }

  return clonedMessages;
}
