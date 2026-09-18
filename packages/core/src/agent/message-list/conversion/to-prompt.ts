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
          // part.image is a string - could be a URL, data URI, raw base64, or a
          // provider file ID (e.g. OpenAI "file-...")
          const categorized = categorizeFileData(part.image, part.mimeType);

          if (categorized.type === 'raw') {
            // Raw base64 — keep as Uint8Array so providers receive raw bytes
            // and don't double-wrap in a data URI (e.g. Gemini inline_data.data)
            processedImage = new Uint8Array(Buffer.from(part.image, 'base64'));
          } else if (categorized.type === 'providerFileId') {
            // Provider file IDs (e.g. OpenAI "file-...") are not parseable URLs and
            // can't be expressed as a V1 image part. Emit a file part instead so the
            // ID survives untouched and providers can forward it by reference.
            const { image: _image, type: _type, ...rest } = part;
            roleContent[role].push({
              ...rest,
              type: 'file',
              data: part.image,
              mimeType: categorized.mimeType || 'application/octet-stream',
            });
            break;
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

  for (const part of modelMessage.content ?? []) {
    // Defensive: upstream rewrites (e.g. observational memory) have produced sparse
    // content arrays in production. A hole here would crash the provider converter
    // with an unattributable "Cannot read properties of undefined (reading 'type')".
    if (!part || typeof part !== 'object') continue;

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
          // Providers read `output.type` unguarded (e.g. @ai-sdk/openai-compatible).
          // An output-less tool result (lost result chunk, OM rewrite) must still
          // present a valid LanguageModelV2ToolResultOutput shape.
          output: part.output ?? { type: 'json', value: null },
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

type ConvertibleToolResultPartType = 'media' | 'image-url' | 'file-url';

/**
 * Convert multimodal tool-result parts (`media`, `image-url`, `file-url`) in a
 * V2 (AI SDK v5 / spec `v2`) prompt using a caller-provided target shape.
 *
 * Mastra's `toModelOutput` and the vendored AI SDK v5 use `{ type: 'media' }`
 * as the authored Base64 tool-result content type, while remote URLs are kept
 * as `image-url`/`file-url` parts. Newer AI SDK provider specs use different
 * content-part shapes, so callers provide the target conversion for their
 * provider spec. Returning the same item from the callback is a pass-through.
 */
function convertToolResultContent(
  prompt: LanguageModelV2Prompt,
  convertPart: (
    contentPart: Record<string, unknown>,
    partType: ConvertibleToolResultPartType,
    mediaType: string,
  ) => unknown,
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
        const isMediaPart = contentPart.type === `media` && typeof contentPart.data === `string`;
        const isUrlPart =
          (contentPart.type === `image-url` || contentPart.type === `file-url`) && typeof contentPart.url === `string`;
        if (!isMediaPart && !isUrlPart) return item;
        const mediaType = typeof contentPart.mediaType === `string` ? contentPart.mediaType : ``;
        const converted = convertPart(contentPart, contentPart.type as ConvertibleToolResultPartType, mediaType);
        if (converted !== item) outputModified = true;
        return converted;
      });

      if (!outputModified) return part;
      messageModified = true;
      return { ...part, output: { ...output, value } };
    });

    return messageModified ? { ...message, content } : message;
  }) as LanguageModelV2Prompt;
}

/**
 * Remote URLs cannot appear in Base64 `media.data`, but messages persisted by
 * older versions stored them there (issue #22618) — `://` is not valid Base64,
 * so this detection is unambiguous. Scheme matching is case-insensitive per
 * RFC 3986: legacy values were stored verbatim, so `HTTPS://…` must heal too.
 */
function isRemoteUrl(data: string): boolean {
  return /^https?:\/\//i.test(data);
}

/**
 * Convert v5-authored media tool results to the `image-data`/`file-data` shape
 * expected only by AI SDK v6 (`v3`) providers. V5 providers accept `media`, and
 * V7 providers expect `file` parts with tagged data instead. `image-url` and
 * `file-url` parts are natively valid V3 tool-result content and pass through
 * unchanged; legacy `media` parts carrying a remote URL are healed into them.
 *
 * See: https://github.com/mastra-ai/mastra/issues/17876 and
 * https://github.com/mastra-ai/mastra/issues/22618
 */
export function aiV5PromptToAIV6Prompt(prompt: LanguageModelV2Prompt): LanguageModelV2Prompt {
  return convertToolResultContent(prompt, (contentPart, partType, mediaType) => {
    if (partType !== `media`) return contentPart;
    const isImage = mediaType.startsWith(`image/`);
    const data = contentPart.data as string;
    if (isRemoteUrl(data)) {
      const rest = { ...contentPart };
      delete rest.data;
      return { ...rest, type: isImage ? `image-url` : `file-url`, url: data };
    }
    return { ...contentPart, type: isImage ? `image-data` : `file-data`, mediaType };
  });
}

export function aiV5PromptToAIV7Prompt(prompt: LanguageModelV2Prompt): LanguageModelV2Prompt {
  return convertToolResultContent(prompt, (contentPart, partType, mediaType) => {
    if (partType === `image-url` || partType === `file-url`) {
      const rest = { ...contentPart };
      delete rest.url;
      return {
        ...rest,
        type: `file`,
        data: { type: `url`, url: contentPart.url },
        // V4 file parts require a mediaType.
        mediaType: mediaType || (partType === `image-url` ? `image/jpeg` : `application/octet-stream`),
      };
    }
    const data = contentPart.data as string;
    if (isRemoteUrl(data)) {
      const rest = { ...contentPart };
      delete rest.data;
      return {
        ...rest,
        type: `file`,
        data: { type: `url`, url: data },
        mediaType: mediaType || `application/octet-stream`,
      };
    }
    return { ...contentPart, type: `file`, data: { type: `data`, data }, mediaType };
  });
}
