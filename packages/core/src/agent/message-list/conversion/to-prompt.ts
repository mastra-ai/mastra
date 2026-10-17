import type { LanguageModelV4Prompt, LanguageModelV4ToolResultOutput } from '@ai-sdk/provider';

type LanguageModelV4ToolResultContent = Extract<LanguageModelV4ToolResultOutput, { type: 'content' }>['value'];

import { anyToV4FileData } from '../../../stream/aisdk/v5/compat/content';
import { convertDataContentToBase64String } from '../prompt/data-content';
import { categorizeFileData } from '../prompt/image-utils';
import type { AIV5Type } from '../types';
import { sanitizeToolName } from '../utils/tool-name';

type AIV5LanguageModelV2Message = LanguageModelV4Prompt[0];

/**
 * Deep-copy plain objects with their keys sorted, so the serialized bytes of tool
 * payloads depend only on content. Storage such as Postgres `jsonb` reorders object
 * keys, and an unstable prompt busts provider prompt caches on resumed runs.
 * Arrays keep their order; non-plain values (Dates, Uint8Arrays, class instances) pass through.
 */
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    return value;
  }
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    // defineProperty keeps an own `__proto__` key as data instead of setting the prototype.
    Object.defineProperty(sorted, key, {
      value: sortKeysDeep((value as Record<string, unknown>)[key]),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return sorted;
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
          input: sortKeysDeep(part.input),
        });
        break;
      }

      case 'tool-result': {
        if (role === `user`) {
          throw new Error(incompatibleMessage);
        }
        // Providers read `output.type` unguarded (e.g. @ai-sdk/openai-compatible).
        // An output-less tool result (lost result chunk, OM rewrite) must still
        // present a valid LanguageModelV4ToolResultOutput shape.
        const output = part.output ?? { type: 'json' as const, value: null };
        roleContent[role].push({
          ...part,
          toolName: sanitizeToolName(part.toolName),
          output:
            output.type === 'json' || output.type === 'error-json'
              ? { ...output, value: sortKeysDeep(output.value) as typeof output.value }
              : output.type === 'content'
                ? {
                    ...output,
                    value: output.value.map(item =>
                      item.type === 'file' ? { ...item, data: anyToV4FileData(item.data) } : item,
                    ) as LanguageModelV4ToolResultContent,
                  }
                : output,
        });
        break;
      }

      case 'file': {
        if (role === `tool`) {
          throw new Error(incompatibleMessage);
        }
        roleContent[role].push({
          ...part,
          data: anyToV4FileData(part.data),
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
          data: anyToV4FileData(part.image),
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
    `Encountered unknown role ${role} when converting V5 ModelMessage -> V5 LanguageModelV4Message, input message: ${JSON.stringify(modelMessage, null, 2)}`,
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
  prompt: LanguageModelV4Prompt,
  convertPart: (
    contentPart: Record<string, unknown>,
    partType: ConvertibleToolResultPartType,
    mediaType: string,
  ) => unknown,
): LanguageModelV4Prompt {
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
  }) as LanguageModelV4Prompt;
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

// V4 file parts carry `url: URL`. Unparseable strings pass through so a bad
// tool output reaches the provider instead of throwing mid-request.
function parseUrl(url: unknown): URL | undefined {
  if (url instanceof URL) return url;
  if (typeof url !== 'string') return undefined;
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}

export function aiV5PromptToAIV7Prompt(prompt: LanguageModelV4Prompt): LanguageModelV4Prompt {
  return convertToolResultContent(prompt, (contentPart, partType, mediaType) => {
    if (partType === `image-url` || partType === `file-url`) {
      const url = parseUrl(contentPart.url);
      // Unparseable URLs can't be a V4 url file part; surface them to the model as text.
      if (!url) return { type: `text`, text: String(contentPart.url) };
      const rest = { ...contentPart };
      delete rest.url;
      return {
        ...rest,
        type: `file`,
        data: { type: `url`, url },
        // V4 file parts require a mediaType.
        mediaType: mediaType || (partType === `image-url` ? `image/jpeg` : `application/octet-stream`),
      };
    }
    const data = contentPart.data as string;
    const remoteUrl = isRemoteUrl(data) ? parseUrl(data) : undefined;
    if (remoteUrl) {
      const rest = { ...contentPart };
      delete rest.data;
      return {
        ...rest,
        type: `file`,
        data: { type: `url`, url: remoteUrl },
        mediaType: mediaType || `application/octet-stream`,
      };
    }
    return { ...contentPart, type: `file`, data: { type: `data`, data }, mediaType };
  });
}
