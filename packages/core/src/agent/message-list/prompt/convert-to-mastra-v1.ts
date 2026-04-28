/**
 * This file is an adaptation of https://github.com/vercel/ai/blob/e14c066bf4d02c5ee2180c56a01fa0e5216bc582/packages/ai/core/prompt/convert-to-core-messages.ts
 * But has been modified to work with Mastra storage adapter messages (MastraMessageV1)
 */
import type { AssistantContent, ToolResultPart } from '@internal/ai-sdk-v4';
import type { MastraMessageV1 } from '../../../memory/types';
import type { MastraMessageContentV2, MastraDBMessage } from '../../message-list';
import {
  getConcreteLegacyField,
  getLegacyContent,
  getLegacyExperimentalAttachments,
  getLegacyToolInvocations,
} from '../utils/legacy-fields';
import { attachmentsToParts } from './attachments-to-parts';

type DerivedUserTextContent = Extract<MastraMessageV1['content'], Array<unknown>>;

const makePushOrCombine = (v1Messages: MastraMessageV1[]) => {
  // Track how many times each ID has been used to create unique IDs for split messages
  const idUsageCount = new Map<string, number>();

  // Pattern to detect if an ID already has our split suffix
  const SPLIT_SUFFIX_PATTERN = /__split-\d+$/;

  return (msg: MastraMessageV1) => {
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
        // @ts-expect-error needs type gymnastics? msg.content and previousMessage.content are the same type here since both are arrays
        previousMessage.content.push(part);
      }
    } else {
      // When pushing a new message, check if we need to deduplicate the ID
      let baseId = msg.id;

      // Check if this ID already has a split suffix and extract the base ID
      const hasSplitSuffix = SPLIT_SUFFIX_PATTERN.test(baseId);
      if (hasSplitSuffix) {
        // This ID already has a split suffix, don't add another one
        v1Messages.push(msg);
        return;
      }

      const currentCount = idUsageCount.get(baseId) || 0;

      // If we've seen this ID before, append our unique split suffix
      if (currentCount > 0) {
        msg.id = `${baseId}__split-${currentCount}`;
      }

      // Increment the usage count for this base ID
      idUsageCount.set(baseId, currentCount + 1);

      v1Messages.push(msg);
    }
  };
};
export function convertToV1Messages(messages: Array<MastraDBMessage>) {
  const v1Messages: MastraMessageV1[] = [];
  const pushOrCombine = makePushOrCombine(v1Messages);
  let previousDerivedUserTextContent: DerivedUserTextContent | undefined;

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const isLastMessage = i === messages.length - 1;
    if (!message?.content) continue;
    const concreteContent = getConcreteLegacyField<string>(message.content, 'content');
    const content = concreteContent ?? getLegacyContent(message.content);
    const inputAttachments = getLegacyExperimentalAttachments(message.content) ?? [];
    const { parts: inputParts } = message.content;
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
        const useStringContent = concreteContent !== undefined || previousDerivedUserTextContent?.length === 1;
        if (parts == null) {
          const userContent = experimental_attachments
            ? [{ type: 'text', text: content || '' }, ...attachmentsToParts(experimental_attachments)]
            : { type: 'text', text: content || '' };
          pushOrCombine({
            role: 'user',
            ...fields,
            type: 'text',
            // @ts-expect-error - content type mismatch in conversion
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
          const outputContent: MastraMessageV1['content'] =
            useStringContent && userContent.length === textParts.length ? content || '' : userContent;

          pushOrCombine({
            role: 'user',
            ...fields,
            type: 'text',
            content: outputContent,
          });

          previousDerivedUserTextContent =
            !useStringContent && Array.isArray(userContent) && userContent.every(part => part.type === 'text')
              ? userContent
              : undefined;
        }
        break;
      }

      case 'assistant': {
        previousDerivedUserTextContent = undefined;
        if (message.content.parts != null) {
          let currentStep = 0;
          let blockHasToolInvocations = false;
          let block: MastraMessageContentV2['parts'] = [];
          const toolInvocations = getLegacyToolInvocations(message.content);
          const partsToolCallIds = new Set(
            message.content.parts
              .filter(
                (part): part is Extract<MastraMessageContentV2['parts'][number], { type: 'tool-invocation' }> =>
                  part.type === 'tool-invocation',
              )
              .map(part => part.toolInvocation.toolCallId),
          );
          const legacyOnlyToolInvocations =
            toolInvocations?.filter(toolInvocation => !partsToolCallIds.has(toolInvocation.toolCallId)) ?? [];

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
              content:
                typeof content !== `string` &&
                Array.isArray(content) &&
                content.length === 1 &&
                content[0]?.type === `text`
                  ? content[0].text
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

          // Recover legacy-only tool invocations from older rows whose parts never carried tool-invocation parts.
          if (legacyOnlyToolInvocations.length > 0) {
            const maxStep = legacyOnlyToolInvocations.reduce((max, toolInvocation) => {
              return Math.max(max, toolInvocation.step ?? 0);
            }, 0);

            for (let i = 0; i <= maxStep; i++) {
              const stepInvocations = legacyOnlyToolInvocations.filter(
                toolInvocation => (toolInvocation.step ?? 0) === i && toolInvocation.toolName !== 'updateWorkingMemory',
              );

              if (stepInvocations.length === 0) {
                continue;
              }

              pushOrCombine({
                role: 'assistant',
                ...fields,
                type: 'tool-call',
                content: stepInvocations.map(({ toolCallId, toolName, args }) => ({
                  type: 'tool-call' as const,
                  toolCallId,
                  toolName,
                  args,
                })),
              });

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

          break;
        }

        const toolInvocations = getLegacyToolInvocations(message.content);

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
              ...(isLastMessage && typeof content === 'string' && i === 0
                ? [{ type: 'text' as const, text: content }]
                : []),
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
