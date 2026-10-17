import type {
  AssistantContent,
  FilePart,
  ModelMessage,
  TextPart,
  ToolContent,
  ToolResultPart,
  UIMessage,
  UIMessagePart,
  UIDataTypes,
  UITools,
} from '@internal/ai-v7';
import { getToolName, isFileUIPart, isReasoningUIPart, isTextUIPart, isToolUIPart } from '@internal/ai-v7';

type Part = UIMessagePart<UIDataTypes, UITools>;
type ToolPart = Extract<Part, { toolCallId: string }>;

function toJSONValue(value: unknown): ToolResultPart['output'] {
  if (typeof value === 'string') return { type: 'text', value };
  const serialized = value === undefined ? undefined : JSON.stringify(value);
  return { type: 'json', value: serialized === undefined ? null : JSON.parse(serialized) };
}

function fileData(part: Extract<Part, { type: 'file' }>): FilePart['data'] {
  return 'providerReference' in part && part.providerReference != null
    ? { type: 'reference', reference: part.providerReference as Record<string, string> }
    : part.url.startsWith('data:')
      ? { type: 'data', data: part.url }
      : { type: 'url', url: new URL(part.url) };
}

function providerOptions(metadata: unknown) {
  return metadata != null ? { providerOptions: metadata as Record<string, any> } : {};
}

/**
 * Converts UI messages to model messages synchronously.
 *
 * Mastra runs its own tools, so unlike the AI SDK converter this never calls a
 * tool's `toModelOutput` and therefore never needs to be async.
 */
export function convertUIToModelMessages(messages: Array<Omit<UIMessage, 'id'>>): ModelMessage[] {
  const modelMessages: ModelMessage[] = [];

  for (const message of messages) {
    switch (message.role) {
      case 'system': {
        const text = message.parts
          .filter(isTextUIPart)
          .map(p => p.text)
          .join('');
        const metadata = message.parts.find(isTextUIPart)?.providerMetadata;
        modelMessages.push({ role: 'system', content: text, ...providerOptions(metadata) });
        break;
      }
      case 'user': {
        const content: Array<TextPart | FilePart> = [];
        for (const part of message.parts) {
          if (isTextUIPart(part)) {
            content.push({ type: 'text', text: part.text, ...providerOptions(part.providerMetadata) });
          } else if (isFileUIPart(part)) {
            content.push({
              type: 'file',
              mediaType: part.mediaType,
              filename: part.filename,
              data: fileData(part),
              ...providerOptions(part.providerMetadata),
            });
          }
        }
        modelMessages.push({ role: 'user', content });
        break;
      }
      case 'assistant': {
        let block: Part[] = [];
        const flush = () => {
          if (block.length === 0) return;
          const content: Exclude<AssistantContent, string> = [];
          for (const part of block) {
            if (isTextUIPart(part)) {
              content.push({ type: 'text', text: part.text, ...providerOptions(part.providerMetadata) });
            } else if (isFileUIPart(part)) {
              content.push({
                type: 'file',
                mediaType: part.mediaType,
                filename: part.filename,
                data: fileData(part),
                ...providerOptions(part.providerMetadata),
              });
            } else if (isReasoningUIPart(part)) {
              content.push({ type: 'reasoning', text: part.text, ...providerOptions(part.providerMetadata) });
            } else if (isToolUIPart(part)) {
              const tool = part as ToolPart;
              if (tool.state === 'input-streaming') continue;
              const toolName = getToolName(part);
              content.push({
                type: 'tool-call',
                toolCallId: tool.toolCallId,
                toolName,
                input: tool.state === 'output-error' ? (tool.input ?? (tool as any).rawInput) : tool.input,
                providerExecuted: tool.providerExecuted,
                ...providerOptions(tool.callProviderMetadata),
              });
              if (
                tool.providerExecuted === true &&
                (tool.state === 'output-available' || tool.state === 'output-error')
              ) {
                content.push({
                  type: 'tool-result',
                  toolCallId: tool.toolCallId,
                  toolName,
                  output:
                    tool.state === 'output-error'
                      ? { type: 'error-json', value: tool.errorText ?? null }
                      : toJSONValue(tool.output),
                  ...providerOptions(tool.callProviderMetadata),
                } as ToolResultPart);
              }
            }
          }
          if (content.length > 0) modelMessages.push({ role: 'assistant', content });

          const toolContent: ToolContent = [];
          for (const part of block) {
            if (!isToolUIPart(part)) continue;
            const tool = part as ToolPart;
            if (tool.providerExecuted === true) continue;
            if (tool.state !== 'output-available' && tool.state !== 'output-error') continue;
            toolContent.push({
              type: 'tool-result',
              toolCallId: tool.toolCallId,
              toolName: getToolName(part),
              output:
                tool.state === 'output-error'
                  ? { type: 'error-text', value: tool.errorText ?? '' }
                  : toJSONValue(tool.output),
              ...providerOptions(tool.callProviderMetadata),
            });
          }
          if (toolContent.length > 0) modelMessages.push({ role: 'tool', content: toolContent });
          block = [];
        };

        for (const part of message.parts) {
          if (part.type === 'step-start') flush();
          else if (isTextUIPart(part) || isReasoningUIPart(part) || isFileUIPart(part) || isToolUIPart(part))
            block.push(part);
        }
        flush();
        break;
      }
    }
  }

  return modelMessages;
}
