import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import type { LanguageModelV1Prompt, CoreMessage as CoreMessageV4 } from '@internal/ai-sdk-v4';

import { convertDataContentToBase64String } from '../prompt/data-content';
import { categorizeFileData, createDataUri } from '../prompt/image-utils';
import type { AIV5Type } from '../types';

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
        roleContent[role].push(part);
        break;
      }

      case 'tool-result': {
        if (role === `assistant` || role === `user`) {
          throw new Error(incompatibleMessage);
        }
        roleContent[role].push(part);
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
            // Raw base64 - convert to data URI before creating URL
            const dataUri = createDataUri(part.image, part.mimeType || 'image/png');
            processedImage = new URL(dataUri);
          } else {
            // It's already a URL or data URI
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
        roleContent[role].push(part);
        break;
      }

      case 'tool-result': {
        if (role === `assistant` || role === `user`) {
          throw new Error(incompatibleMessage);
        }
        roleContent[role].push(part);
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
