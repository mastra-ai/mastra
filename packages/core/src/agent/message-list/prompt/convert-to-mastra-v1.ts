/**
 * This file is an adaptation of https://github.com/vercel/ai/blob/e14c066bf4d02c5ee2180c56a01fa0e5216bc582/packages/ai/core/prompt/convert-to-core-messages.ts
 * But has been modified to work with Mastra storage adapter messages (MastraMessageV1)
 */
import type { AssistantContent, ToolResultPart } from '@internal/ai-sdk-v4/message';
import type { MastraMessageV1 } from '../../../memory/types';
import type { MastraMessageContentV2, MastraDBMessage } from '../../message-list';
import { attachmentsToParts } from './attachments-to-parts';

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
        // @ts-ignore needs type gymnastics? msg.content and previousMessage.content are the same type here since both are arrays
        // I'm not sure what's adding `never` to the union but this code definitely works..
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

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const isLastMessage = i === messages.length - 1;
    if (!message?.content) continue;
    const { experimental_attachments: inputAttachments = [], parts: inputParts } = message.content;
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
        if (parts == null || parts.length === 0) {
          // Extract text content from parts if available
          const textContent = inputParts?.find(p => p.type === 'text')?.text || '';
          const userContent =
            experimental_attachments.length > 0
              ? [{ type: 'text', text: textContent }, ...attachmentsToParts(experimental_attachments)]
              : { type: 'text', text: textContent };
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
              Array.isArray(userContent) && userContent.length === 1 && userContent[0]?.type === `text`
                ? userContent[0].text
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

          // Tool invocations are now only stored in parts array
          // No need to check for separate toolInvocations field

          break;
        }

        // Extract tool invocations from parts
        const partsArray = (message.content as any).parts || [];
        const toolInvocationParts = partsArray.filter(
          (p: any) => p.type === 'tool-invocation' && p.toolInvocation?.toolName !== 'updateWorkingMemory',
        ) as any[];

        // Extract text content from parts
        const textContent = partsArray.find((p: any) => p.type === 'text')?.text || '';

        if (toolInvocationParts.length === 0) {
          pushOrCombine({ role: 'assistant', ...fields, content: textContent, type: 'text' });
          break;
        }

        const maxStep = toolInvocationParts.reduce((max: number, part: any) => {
          const step = part.toolInvocation?.step ?? 0;
          return Math.max(max, step);
        }, 0);

        for (let i = 0; i <= maxStep; i++) {
          const stepInvocations = toolInvocationParts.filter((part: any) => (part.toolInvocation?.step ?? 0) === i);

          if (stepInvocations.length === 0) {
            continue;
          }

          // assistant message with tool calls
          pushOrCombine({
            role: 'assistant',
            ...fields,
            type: 'tool-call',
            content: [
              ...(isLastMessage && textContent && i === 0 ? [{ type: 'text' as const, text: textContent }] : []),
              ...stepInvocations.map((part: any) => ({
                type: 'tool-call' as const,
                toolCallId: part.toolInvocation.toolCallId,
                toolName: part.toolInvocation.toolName,
                args: part.toolInvocation.args,
              })),
            ],
          });

          // Only create tool-result message if there are actual results
          const invocationsWithResults = stepInvocations.filter(
            (part: any) => part.toolInvocation.state === 'result' && 'result' in part.toolInvocation,
          );

          if (invocationsWithResults.length > 0) {
            pushOrCombine({
              role: 'tool',
              ...fields,
              type: 'tool-result',
              content: invocationsWithResults.map((part: any): ToolResultPart => {
                const { toolCallId, toolName, result } = part.toolInvocation;
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

        if (textContent && !isLastMessage) {
          pushOrCombine({ role: 'assistant', ...fields, type: 'text', content: textContent });
        }

        break;
      }
    }
  }

  return v1Messages;
}
