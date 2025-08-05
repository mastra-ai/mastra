/**
 * This file is an adaptation of https://github.com/vercel/ai/blob/e14c066bf4d02c5ee2180c56a01fa0e5216bc582/packages/ai/core/prompt/convert-to-core-messages.ts
 * But has been modified to work with Mastra storage adapter messages (MastraMessageV1)
 */
import type { AssistantContent, ToolResultPart } from 'ai';
import type { MastraMessageV1 } from '../../../memory/types';
import type { MastraMessageContentV2, MastraMessageV2 } from '../../message-list';
import { attachmentsToParts } from './attachments-to-parts';

const makePushOrCombine = (v1Messages: MastraMessageV1[]) => (msg: MastraMessageV1) => {
  const previousMessage = v1Messages.at(-1);
  if (
    msg.role === previousMessage?.role &&
    Array.isArray(previousMessage.content) &&
    Array.isArray(msg.content) &&
    // we were creating new messages for tool calls before and not appending to the assistant message
    // so don't append here so everything works as before
    (msg.role !== `assistant` || (msg.role === `assistant` && msg.content.at(-1)?.type !== `tool-call`))
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
    const isLastMessage = i === messages.length - 1;
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
                  // Skip updateWorkingMemory tool calls as they should not be visible in history
                  if (part.toolInvocation.toolName !== 'updateWorkingMemory') {
                    content.push({
                      type: 'tool-call' as const,
                      toolCallId: part.toolInvocation.toolCallId,
                      toolName: part.toolInvocation.toolName,
                      args: part.toolInvocation.args,
                    });
                  }
                  break;
              }
            }

            pushOrCombine({
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
              .map(part => part.toolInvocation)
              .filter(ti => ti.toolName !== 'updateWorkingMemory');

            // Only create tool-result message if there are actual results
            const invocationsWithResults = stepInvocations.filter(ti => ti.state === 'result' && 'result' in ti);

            if (invocationsWithResults.length > 0) {
              pushOrCombine({
                role: 'tool',
                ...fields,
                type: 'tool-result',
                content: invocationsWithResults.map((toolInvocation): ToolResultPart => {
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

            // updates for next block
            block = [];
            blockHasToolInvocations = false;
            currentStep++;
          }

          for (const part of message.content.parts) {
            switch (part.type) {
              case 'text': {
                if (blockHasToolInvocations) {
                  processBlock(); // text must come after tool invocations
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
                // If we have non-tool content (text/file/reasoning) in the block, process it first
                const hasNonToolContent = block.some(
                  p => p.type === 'text' || p.type === 'file' || p.type === 'reasoning',
                );
                if (hasNonToolContent || (part.toolInvocation.step ?? 0) !== currentStep) {
                  processBlock();
                }
                block.push(part);
                blockHasToolInvocations = true;
                break;
              }
            }
          }

          processBlock();

          // Check if there are toolInvocations that weren't processed from parts
          const toolInvocations = message.content.toolInvocations;
          if (toolInvocations && toolInvocations.length > 0) {
            // Find tool invocations that weren't already processed from parts
            const processedToolCallIds = new Set<string>();
            for (const part of message.content.parts) {
              if (part.type === 'tool-invocation' && part.toolInvocation.toolCallId) {
                processedToolCallIds.add(part.toolInvocation.toolCallId);
              }
            }

            const unprocessedToolInvocations = toolInvocations.filter(
              ti => !processedToolCallIds.has(ti.toolCallId) && ti.toolName !== 'updateWorkingMemory',
            );

            if (unprocessedToolInvocations.length > 0) {
              // Group by step, handling undefined steps
              const invocationsByStep = new Map<number, typeof unprocessedToolInvocations>();

              for (const inv of unprocessedToolInvocations) {
                const step = inv.step ?? 0;
                if (!invocationsByStep.has(step)) {
                  invocationsByStep.set(step, []);
                }
                invocationsByStep.get(step)!.push(inv);
              }

              // Process each step
              const sortedSteps = Array.from(invocationsByStep.keys()).sort((a, b) => a - b);

              for (const step of sortedSteps) {
                const stepInvocations = invocationsByStep.get(step)!;

                // Create tool-call message for all invocations (calls and results)
                pushOrCombine({
                  role: 'assistant',
                  ...fields,
                  type: 'tool-call',
                  content: [
                    ...stepInvocations.map(({ toolCallId, toolName, args }) => ({
                      type: 'tool-call' as const,
                      toolCallId,
                      toolName,
                      args,
                    })),
                  ],
                });

                // Only create tool-result message if there are actual results
                const invocationsWithResults = stepInvocations.filter(ti => ti.state === 'result' && 'result' in ti);

                if (invocationsWithResults.length > 0) {
                  pushOrCombine({
                    role: 'tool',
                    ...fields,
                    type: 'tool-result',
                    content: invocationsWithResults.map((toolInvocation): ToolResultPart => {
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
              }
            }
          }

          break;
        }

        const toolInvocations = message.content.toolInvocations;

        if (toolInvocations == null || toolInvocations.length === 0) {
          pushOrCombine({ role: 'assistant', ...fields, content: content || '', type: 'text' });
          break;
        }

        const maxStep = toolInvocations.reduce((max, toolInvocation) => {
          return Math.max(max, toolInvocation.step ?? 0);
        }, 0);

        for (let i = 0; i <= maxStep; i++) {
          const stepInvocations = toolInvocations.filter(
            toolInvocation => (toolInvocation.step ?? 0) === i && toolInvocation.toolName !== 'updateWorkingMemory',
          );

          if (stepInvocations.length === 0) {
            continue;
          }

          // assistant message with tool calls
          pushOrCombine({
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

          // Only create tool-result message if there are actual results
          const invocationsWithResults = stepInvocations.filter(ti => ti.state === 'result' && 'result' in ti);

          if (invocationsWithResults.length > 0) {
            pushOrCombine({
              role: 'tool',
              ...fields,
              type: 'tool-result',
              content: invocationsWithResults.map((toolInvocation): ToolResultPart => {
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
        }

        if (content && !isLastMessage) {
          pushOrCombine({ role: 'assistant', ...fields, type: 'text', content: content || '' });
        }

        break;
      }
    }
  }

  return v1Messages;
}
