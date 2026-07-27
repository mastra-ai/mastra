import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import type { LanguageModelV1Prompt, CoreMessage as CoreMessageV4 } from '@internal/ai-sdk-v4';

import { convertDataContentToBase64String } from '../prompt/data-content';
import { categorizeFileData } from '../prompt/image-utils';
import type { AIV5Type } from '../types';
import { sanitizeToolName } from '../utils/tool-name';

type AIV5LanguageModelV2Message = LanguageModelV2Prompt[0];
type LanguageModelV1Message = LanguageModelV1Prompt[0];

/**
 * Convert an AI SDK V4 CoreMessage to a V1 LanguageModel prompt message.
 * Used for creating LLM prompt messages without AI SDK streamText/generateText.
 */
export function aiV4CoreMessageToV1PromptMessage(coreMessage: CoreMessageV4): LanguageModelV1Message {
  if (coreMessage.role === `system`) {
    return coreMessage;
  }

  if (typeof coreMessage.content === `string` && (coreMessage.role === `assistant` || coreMessage.role === `user`)) {
    return {
      ...coreMessage,
      content: [{ type: 'text', text: coreMessage.content }],
    };
  }

  if (typeof coreMessage.content === `string`) {
    throw new Error(
      `Saw text content for input CoreMessage, but the role is ${coreMessage.role}. This is only allowed for "system", "assistant", and "user" roles.`,
    );
  }

  const roleContent: {
    user: Exclude<Extract<LanguageModelV1Message, { role: 'user' }>['content'], string>;
    assistant: Exclude<Extract<LanguageModelV1Message, { role: 'assistant' }>['content'], string>;
    tool: Exclude<Extract<LanguageModelV1Message, { role: 'tool' }>['content'], string>;
  } = {
    user: [],
    assistant: [],
    tool: [],
  };

  const role = coreMessage.role;

  for (const part of coreMessage.content) {
    const incompatibleMessage = `Saw incompatible message content part type ${part.type} for message role ${role}`;

    switch (part.type) {
      case 'text': {
        if (role === `tool`) {
          throw new Error(incompatibleMessage);
        }
        roleContent[role].push(part);
        break;
      }

      case 'redacted-reasoning':
      case 'reasoning': {
        if (role !== `assistant`) {
          throw new Error(incompatibleMessage);
        }
        roleContent[role].push(part);
        break;
      }

      case 'tool-call': {
        if (role === `tool` || role === `user`) {
          throw new Error(incompatibleMessage);
        }
        roleContent[role].push({
          ...part,
          toolName: sanitizeToolName(part.toolName),
        });
        break;
      }

      case 'tool-result': {
        if (role === `assistant` || role === `user`) {
          throw new Error(incompatibleMessage);
        }
        roleContent[role].push({
          ...part,
          toolName: sanitizeToolName(part.toolName),
        });
        break;
      }

      case 'image': {
        if (role === `tool` || role === `assistant`) {
          throw new Error(incompatibleMessage);
        }

        let processedImage: URL | Uint8Array;

        if (part.image instanceof URL || part.image instanceof Uint8Array) {
          processedImage = part.image;
        } else if (Buffer.isBuffer(part.image) || part.image instanceof ArrayBuffer) {
          processedImage = new Uint8Array(part.image);
        } else {
          // part.image is a string - could be a URL, data URI, or raw base64
          const categorized = categorizeFileData(part.image, part.mimeType);

          if (categorized.type === 'raw') {
            // Raw base64 — keep as Uint8Array so providers receive raw bytes
            // and don't double-wrap in a data URI (e.g. Gemini inline_data.data)
            processedImage = new Uint8Array(Buffer.from(part.image, 'base64'));
          } else {
            processedImage = new URL(part.image);
          }
        }

        roleContent[role].push({
          ...part,
          image: processedImage,
        });
        break;
      }

      case 'file': {
        if (role === `tool`) {
          throw new Error(incompatibleMessage);
        }
        roleContent[role].push({
          ...part,
          data:
            part.data instanceof URL
              ? part.data
              : typeof part.data === 'string'
                ? part.data
                : convertDataContentToBase64String(part.data),
        });
        break;
      }
    }
  }

  if (role === `tool`) {
    return {
      ...coreMessage,
      content: roleContent[role],
    };
  }
  if (role === `user`) {
    return {
      ...coreMessage,
      content: roleContent[role],
    };
  }
  if (role === `assistant`) {
    return {
      ...coreMessage,
      content: roleContent[role],
    };
  }

  throw new Error(
    `Encountered unknown role ${role} when converting V4 CoreMessage -> V4 LanguageModelV1Prompt, input message: ${JSON.stringify(coreMessage, null, 2)}`,
  );
}

/**
 * Convert an AI SDK V5 ModelMessage to a V2 LanguageModel prompt message.
 * Used for creating LLM prompt messages without AI SDK streamText/generateText.
 */
export function aiV5ModelMessageToV2PromptMessage(modelMessage: AIV5Type.ModelMessage): AIV5LanguageModelV2Message {
  if (modelMessage.role === `system`) {
    return modelMessage;
  }

  if (typeof modelMessage.content === `string` && (modelMessage.role === `assistant` || modelMessage.role === `user`)) {
    return {
      role: modelMessage.role,
      content: [{ type: 'text', text: modelMessage.content }],
      providerOptions: modelMessage.providerOptions,
    };
  }

  if (typeof modelMessage.content === `string`) {
    throw new Error(
      `Saw text content for input ModelMessage, but the role is ${modelMessage.role}. This is only allowed for "system", "assistant", and "user" roles.`,
    );
  }

  const roleContent: {
    user: Extract<AIV5LanguageModelV2Message, { role: 'user' }>['content'];
    assistant: Extract<AIV5LanguageModelV2Message, { role: 'assistant' }>['content'];
    tool: Extract<AIV5LanguageModelV2Message, { role: 'tool' }>['content'];
  } = {
    user: [],
    assistant: [],
    tool: [],
  };

  const role = modelMessage.role;

  for (const part of modelMessage.content) {
    const incompatibleMessage = `Saw incompatible message content part type ${part.type} for message role ${role}`;

    switch (part.type) {
      case 'text': {
        if (role === `tool`) {
          throw new Error(incompatibleMessage);
        }
        roleContent[role].push(part);
        break;
      }

      case 'reasoning': {
        if (role === `tool` || role === `user`) {
          throw new Error(incompatibleMessage);
        }
        roleContent[role].push(part);
        break;
      }

      case 'tool-call': {
        if (role !== `assistant`) {
          throw new Error(incompatibleMessage);
        }
        roleContent[role].push({
          ...part,
          toolName: sanitizeToolName(part.toolName),
        });
        break;
      }

      case 'tool-result': {
        if (role === `user`) {
          throw new Error(incompatibleMessage);
        }
        roleContent[role].push({
          ...part,
          toolName: sanitizeToolName(part.toolName),
        });
        break;
      }

      case 'file': {
        if (role === `tool`) {
          throw new Error(incompatibleMessage);
        }
        roleContent[role].push({
          ...part,
          data: part.data instanceof ArrayBuffer ? new Uint8Array(part.data) : part.data,
        });
        break;
      }

      case 'image': {
        if (role === `tool`) {
          throw new Error(incompatibleMessage);
        }
        roleContent[role].push({
          ...part,
          mediaType: part.mediaType || 'image/unknown',
          type: 'file',
          data: part.image instanceof ArrayBuffer ? new Uint8Array(part.image) : part.image,
        });
        break;
      }
    }
  }

  if (role === `tool`) {
    return {
      ...modelMessage,
      content: roleContent[role],
    };
  }
  if (role === `user`) {
    return {
      ...modelMessage,
      content: roleContent[role],
    };
  }
  if (role === `assistant`) {
    return {
      ...modelMessage,
      content: roleContent[role],
    };
  }

  throw new Error(
    `Encountered unknown role ${role} when converting V5 ModelMessage -> V5 LanguageModelV2Message, input message: ${JSON.stringify(modelMessage, null, 2)}`,
  );
}

/**
 * Convert tool-result `media` parts in a V2 (AI SDK v5 / spec `v2`) prompt
 * using a caller-provided target content-part shape.
 *
 * Mastra's `toModelOutput` and the vendored AI SDK v5 use `{ type: 'media' }`
 * as the authored multimodal tool-result content type. Newer AI SDK provider
 * specs use different content-part shapes, so callers provide the target
 * conversion for their provider spec.
 */
function convertToolResultContent(
  prompt: LanguageModelV2Prompt,
  convertMediaPart: (contentPart: Record<string, unknown>, mediaType: string) => unknown,
): LanguageModelV2Prompt {
  return prompt.map(message => {
    if (message.role !== `tool`) return message;

    let messageModified = false;
    const content = message.content.map(part => {
      if (part.type !== `tool-result`) return part;
      const output = part.output as { type?: unknown; value?: unknown } | undefined;
      if (!output || output.type !== `content` || !Array.isArray(output.value)) return part;

      let outputModified = false;
      const value = (output.value as unknown[]).map(item => {
        if (item == null || typeof item !== `object`) return item;
        const contentPart = item as Record<string, unknown>;
        if (contentPart.type !== `media` || typeof contentPart.data !== `string`) return item;
        outputModified = true;
        const mediaType = typeof contentPart.mediaType === `string` ? contentPart.mediaType : ``;
        return convertMediaPart(contentPart, mediaType);
      });

      if (!outputModified) return part;
      messageModified = true;
      return { ...part, output: { ...output, value } };
    });

    return messageModified ? { ...message, content } : message;
  }) as LanguageModelV2Prompt;
}

/**
 * Convert v5-authored media tool results to the `image-data`/`file-data` shape
 * expected only by AI SDK v6 (`v3`) providers. V5 providers accept `media`, and
 * V7 providers expect `file` parts with tagged data instead.
 *
 * See: https://github.com/mastra-ai/mastra/issues/17876
 */
export function aiV5PromptToAIV6Prompt(prompt: LanguageModelV2Prompt): LanguageModelV2Prompt {
  return convertToolResultContent(prompt, (contentPart, mediaType) =>
    mediaType.startsWith(`image/`)
      ? { type: `image-data`, data: contentPart.data, mediaType }
      : { type: `file-data`, data: contentPart.data, mediaType },
  );
}

export function aiV5PromptToAIV7Prompt(prompt: LanguageModelV2Prompt): LanguageModelV2Prompt {
  return convertToolResultContent(prompt, (contentPart, mediaType) => ({
    type: `file`,
    data: { type: `data`, data: contentPart.data },
    mediaType,
  }));
}
