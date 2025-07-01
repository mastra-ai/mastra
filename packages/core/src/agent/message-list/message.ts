import type { CoreMessage, UIMessage } from 'ai';
import type { MastraMessageV1 } from '../../memory';
import { isCoreMessage, isUiMessage } from '../../utils';
import type { MessageInput, MastraMessageV2 } from '../message-list';

export class Message {
  static isVercelUIMessage(msg: MessageInput): msg is UIMessage {
    return !Message.isMastraMessage(msg) && isUiMessage(msg);
  }

  static isVercelCoreMessage(msg: MessageInput): msg is CoreMessage {
    return !Message.isMastraMessage(msg) && isCoreMessage(msg);
  }

  static isMastraMessage(msg: MessageInput): msg is MastraMessageV2 | MastraMessageV1 {
    return Message.isMastraMessageV2(msg) || Message.isMastraMessageV1(msg);
  }

  static isMastraMessageV1(msg: MessageInput): msg is MastraMessageV1 {
    return !Message.isMastraMessageV2(msg) && (`threadId` in msg || `resourceId` in msg);
  }

  static isMastraMessageV2(msg: MessageInput): msg is MastraMessageV2 {
    return Boolean(
      msg.content &&
        !Array.isArray(msg.content) &&
        typeof msg.content !== `string` &&
        // any newly saved Mastra message v2 shape will have content: { format: 2 }
        `format` in msg.content &&
        msg.content.format === 2,
    );
  }

  static getRole(message: MessageInput): MastraMessageV2['role'] {
    if (message.role === `assistant` || message.role === `tool`) return `assistant`;
    if (message.role === `user`) return `user`;
    // TODO: how should we handle data role?
    throw new Error(
      `BUG: add handling for message role ${message.role} in message ${JSON.stringify(message, null, 2)}`,
    );
  }

  static cacheKeyFromParts(parts: UIMessage['parts']): string {
    let key = ``;
    for (const part of parts) {
      key += part.type;
      if (part.type === `text`) {
        // TODO: we may need to hash this with something like xxhash instead of using length
        // for 99.999% of cases this will be fine though because we're comparing messages that have the same ID already.
        key += part.text.length;
      }
      if (part.type === `tool-invocation`) {
        key += part.toolInvocation.toolCallId;
        key += part.toolInvocation.state;
      }
      if (part.type === `reasoning`) {
        // TODO: we may need to hash this with something like xxhash instead of using length
        // for 99.999% of cases this will be fine though because we're comparing messages that have the same ID already.
        key += part.reasoning.length;
        key += part.details.reduce((prev, current) => {
          if (current.type === `text`) {
            return prev + current.text.length + (current.signature?.length || 0);
          }
          return prev;
        }, 0);
      }
      if (part.type === `file`) {
        // TODO: we may need to hash this with something like xxhash instead of using length
        // for 99.999% of cases this will be fine though because we're comparing messages that have the same ID already.
        key += part.data.length;
        key += part.mimeType;
      }
    }
    return key;
  }

  static coreContentToString(content: CoreMessage['content']): string {
    if (typeof content === `string`) return content;

    return content.reduce((p, c) => {
      if (c.type === `text`) {
        p += c.text;
      }
      return p;
    }, '');
  }

  static cacheKeyFromContent(content: CoreMessage['content']): string {
    if (typeof content === `string`) return content;
    let key = ``;
    for (const part of content) {
      key += part.type;
      if (part.type === `text`) {
        key += part.text.length;
      }
      if (part.type === `reasoning`) {
        key += part.text.length;
      }
      if (part.type === `tool-call`) {
        key += part.toolCallId;
        key += part.toolName;
      }
      if (part.type === `tool-result`) {
        key += part.toolCallId;
        key += part.toolName;
      }
      if (part.type === `file`) {
        key += part.filename;
        key += part.mimeType;
      }
      if (part.type === `image`) {
        key += part.image instanceof URL ? part.image.toString() : part.image.toString().length;
        key += part.mimeType;
      }
      if (part.type === `redacted-reasoning`) {
        key += part.data.length;
      }
    }
    return key;
  }

  static messagesAreEqual(one: MessageInput, two: MessageInput) {
    const oneUI = Message.isVercelUIMessage(one) && one;
    const twoUI = Message.isVercelUIMessage(two) && two;
    if (oneUI && !twoUI) return false;
    if (oneUI && twoUI) {
      return Message.cacheKeyFromParts(one.parts) === Message.cacheKeyFromParts(two.parts);
    }

    const oneCM = Message.isVercelCoreMessage(one) && one;
    const twoCM = Message.isVercelCoreMessage(two) && two;
    if (oneCM && !twoCM) return false;
    if (oneCM && twoCM) {
      return Message.cacheKeyFromContent(oneCM.content) === Message.cacheKeyFromContent(twoCM.content);
    }

    const oneMM1 = Message.isMastraMessageV1(one) && one;
    const twoMM1 = Message.isMastraMessageV1(two) && two;
    if (oneMM1 && !twoMM1) return false;
    if (oneMM1 && twoMM1) {
      return (
        oneMM1.id === twoMM1.id &&
        Message.cacheKeyFromContent(oneMM1.content) === Message.cacheKeyFromContent(twoMM1.content)
      );
    }

    const oneMM2 = Message.isMastraMessageV2(one) && one;
    const twoMM2 = Message.isMastraMessageV2(two) && two;
    if (oneMM2 && !twoMM2) return false;
    if (oneMM2 && twoMM2) {
      return (
        oneMM2.id === twoMM2.id &&
        Message.cacheKeyFromParts(oneMM2.content.parts) === Message.cacheKeyFromParts(twoMM2.content.parts)
      );
    }

    // default to it did change. we'll likely never reach this codepath
    return true;
  }

  static toUIMessage(m: MastraMessageV2): UIMessage {
    const experimentalAttachments: UIMessage['experimental_attachments'] = m.content.experimental_attachments
      ? [...m.content.experimental_attachments]
      : [];
    const contentString =
      typeof m.content.content === `string` && m.content.content !== ''
        ? m.content.content
        : m.content.parts.reduce((prev, part) => {
            if (part.type === `text`) {
              // return only the last text part like AI SDK does
              return part.text;
            }
            return prev;
          }, '');

    const parts: MastraMessageV2['content']['parts'] = [];
    if (m.content.parts.length) {
      for (const part of m.content.parts) {
        if (part.type === `file`) {
          experimentalAttachments.push({
            contentType: part.mimeType,
            url: part.data,
          });
        } else {
          parts.push(part);
        }
      }
    }

    if (parts.length === 0 && experimentalAttachments.length > 0) {
      // make sure we have atleast one part so this message doesn't get removed when converting to core message
      parts.push({ type: 'text', text: '' });
    }

    if (m.role === `user`) {
      return {
        id: m.id,
        role: m.role,
        content: m.content.content || contentString,
        createdAt: m.createdAt,
        parts,
        experimental_attachments: experimentalAttachments,
      };
    } else if (m.role === `assistant`) {
      return {
        id: m.id,
        role: m.role,
        content: m.content.content || contentString,
        createdAt: m.createdAt,
        parts,
        reasoning: undefined,
        toolInvocations: `toolInvocations` in m.content ? m.content.toolInvocations : undefined,
      };
    }

    return {
      id: m.id,
      role: m.role,
      content: m.content.content || contentString,
      createdAt: m.createdAt,
      parts,
      experimental_attachments: experimentalAttachments,
    };
  }
}

