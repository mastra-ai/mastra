import type { ToolInvocation as ToolInvocationV4 } from '@internal/ai-sdk-v4';

import { categorizeFileData, createDataUri } from '../prompt/image-utils';
import type {
  MastraDBMessage,
  MastraLegacyMessageAnnotations,
  MastraLegacyMessageAttachments,
  MastraLegacyMessageContent,
  MastraLegacyReasoning,
  MastraLegacyToolInvocations,
  MastraMessageContentV2,
  MastraMessageContentV2WithLegacyFields,
  MastraMessagePart,
} from '../state/types';

const legacyFieldNames = [
  'content',
  'toolInvocations',
  'reasoning',
  'annotations',
  'experimental_attachments',
] as const;

function cloneContentWithoutLegacyFields(
  content?: MastraMessageContentV2WithLegacyFields,
): MastraMessageContentV2 | undefined {
  if (!content) return content;
  const strippedContent = {} as MastraMessageContentV2;
  const descriptors = Object.getOwnPropertyDescriptors(content);

  for (const field of legacyFieldNames) {
    if (descriptors[field] && !('value' in descriptors[field])) {
      delete descriptors[field];
    }
  }

  Object.defineProperties(strippedContent, descriptors);
  return strippedContent;
}

function getConcreteLegacyField<T>(
  content: MastraMessageContentV2,
  field: (typeof legacyFieldNames)[number],
): T | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(content, field);
  if (descriptor && 'value' in descriptor) {
    return descriptor.value as T | undefined;
  }

  return undefined;
}

function clonePart(part: MastraMessagePart): MastraMessagePart {
  if (!part) return part;
  if (part.type === 'tool-invocation') {
    return {
      ...part,
      toolInvocation: {
        ...part.toolInvocation,
      },
    };
  }

  return { ...part };
}

function getContentFromParts(parts: MastraMessagePart[]): MastraLegacyMessageContent | undefined {
  let content = '';
  for (const part of parts) {
    if (part.type === 'text') {
      content = part.text;
    }
  }

  return content === '' ? undefined : content;
}

function getPartsFromValue(content?: MastraMessageContentV2): MastraMessagePart[] {
  return Array.isArray(content?.parts) ? content.parts : [];
}

function getParts(content?: MastraMessageContentV2): MastraMessagePart[] {
  const parts = getPartsFromValue(content);
  if (parts.length > 0) return parts;

  const descriptor = content ? Object.getOwnPropertyDescriptor(content, 'content') : undefined;
  if (descriptor && 'value' in descriptor && descriptor.value !== undefined) {
    return [{ type: 'text', text: descriptor.value }];
  }

  return parts;
}

function isMastraMessageContentV2(content: unknown): content is MastraMessageContentV2 {
  return (
    !!content &&
    typeof content === 'object' &&
    !Array.isArray(content) &&
    (content as Partial<MastraMessageContentV2>).format === 2
  );
}

function getReasoningFromParts(parts: MastraMessagePart[]): MastraLegacyReasoning | undefined {
  const reasoning = parts
    .filter(part => part.type === 'reasoning')
    .map(part => {
      if (part.reasoning) return part.reasoning;
      return part.details
        .map(detail => {
          if (detail.type === 'text') return detail.text;
          return '';
        })
        .join('');
    })
    .filter(Boolean)
    .join('\n');

  return reasoning || undefined;
}

function getExperimentalAttachmentsFromParts(parts: MastraMessagePart[]): MastraLegacyMessageAttachments | undefined {
  const attachments = parts
    .filter(part => part.type === 'file')
    .map(part => {
      let url = part.data;
      if (typeof part.data === 'string') {
        const categorized = categorizeFileData(part.data, part.mimeType);
        url =
          categorized.type === 'raw'
            ? createDataUri(part.data, part.mimeType || 'application/octet-stream')
            : part.data;
      }

      return {
        contentType: part.mimeType,
        url,
      };
    });

  return attachments.length > 0 ? attachments : undefined;
}

function getToolInvocationsFromParts(parts: MastraMessagePart[]): MastraLegacyToolInvocations | undefined {
  const toolInvocations = parts
    .filter((part): part is Extract<MastraMessagePart, { type: 'tool-invocation' }> => part.type === 'tool-invocation')
    .map(part => part.toolInvocation as ToolInvocationV4);

  return toolInvocations.length > 0 ? toolInvocations : undefined;
}

function legacyToolInvocationsToParts(toolInvocations: NonNullable<MastraLegacyToolInvocations>): MastraMessagePart[] {
  return toolInvocations.map(toolInvocation => ({
    type: 'tool-invocation',
    toolInvocation: { ...toolInvocation },
  }));
}

function legacyAttachmentsToParts(attachments: NonNullable<MastraLegacyMessageAttachments>): MastraMessagePart[] {
  return attachments.map(attachment => ({
    type: 'file',
    data: attachment.url,
    mimeType: attachment.contentType || 'application/octet-stream',
  }));
}

function legacyReasoningToPart(reasoning: NonNullable<MastraLegacyReasoning>): MastraMessagePart {
  return {
    type: 'reasoning',
    reasoning: '',
    details: [{ type: 'text', text: reasoning }],
  };
}

function mergeLegacyContentIntoParts(
  parts: MastraMessagePart[],
  legacyContent: MastraLegacyMessageContent | undefined,
): MastraMessagePart[] {
  if (legacyContent === undefined) return parts;

  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (!part || part.type !== 'text') continue;

    part.text = legacyContent;
    return parts;
  }

  if (parts.length === 0) {
    return [{ type: 'text', text: legacyContent }];
  }

  return parts;
}

function updatePartsFromLegacyFields(content?: MastraMessageContentV2WithLegacyFields): MastraMessagePart[] {
  const parts = getParts(content).map(clonePart);
  if (!content) return parts;

  const descriptors = Object.getOwnPropertyDescriptors(content);
  const legacyContent = descriptors.content && 'value' in descriptors.content ? descriptors.content.value : undefined;

  const legacyToolInvocations =
    descriptors.toolInvocations && 'value' in descriptors.toolInvocations
      ? descriptors.toolInvocations.value
      : undefined;
  if (legacyToolInvocations?.length && !parts.some(part => part.type === 'tool-invocation')) {
    parts.push(...legacyToolInvocationsToParts(legacyToolInvocations));
  }

  const legacyAttachments =
    descriptors.experimental_attachments && 'value' in descriptors.experimental_attachments
      ? descriptors.experimental_attachments.value
      : undefined;
  if (legacyAttachments?.length && !parts.some(part => part.type === 'file')) {
    parts.push(...legacyAttachmentsToParts(legacyAttachments));
  }

  const legacyReasoning =
    descriptors.reasoning && 'value' in descriptors.reasoning ? descriptors.reasoning.value : undefined;
  if (legacyReasoning && !parts.some(part => part.type === 'reasoning')) {
    parts.push(legacyReasoningToPart(legacyReasoning));
  }

  if (getPartsFromValue(content).length === 0 && legacyContent !== undefined) return parts;

  return mergeLegacyContentIntoParts(parts, legacyContent);
}

export function getLegacyContent(content: MastraMessageContentV2): MastraLegacyMessageContent | undefined {
  const concreteContent = getConcreteLegacyField<MastraLegacyMessageContent>(content, 'content');
  if (concreteContent !== undefined) return concreteContent;

  return getContentFromParts(getParts(content));
}

export function getLegacyReasoning(content: MastraMessageContentV2): MastraLegacyReasoning | undefined {
  const concreteReasoning = getConcreteLegacyField<MastraLegacyReasoning>(content, 'reasoning');
  if (concreteReasoning !== undefined) return concreteReasoning;

  return getReasoningFromParts(getParts(content));
}

export function getLegacyExperimentalAttachments(
  content: MastraMessageContentV2,
): MastraLegacyMessageAttachments | undefined {
  const concreteAttachments = getConcreteLegacyField<MastraLegacyMessageAttachments>(
    content,
    'experimental_attachments',
  );
  if (concreteAttachments !== undefined) return concreteAttachments;

  return getExperimentalAttachmentsFromParts(getParts(content));
}

export function getLegacyToolInvocations(content: MastraMessageContentV2): MastraLegacyToolInvocations | undefined {
  const concreteToolInvocations = getConcreteLegacyField<MastraLegacyToolInvocations>(content, 'toolInvocations');
  if (concreteToolInvocations !== undefined) return concreteToolInvocations;

  return getToolInvocationsFromParts(getParts(content));
}

export function getLegacyAnnotations(content: MastraMessageContentV2): MastraLegacyMessageAnnotations | undefined {
  return getConcreteLegacyField<MastraLegacyMessageAnnotations>(content, 'annotations');
}

export function getLegacyContentForStorage(
  content?: MastraMessageContentV2WithLegacyFields,
  options: { mergeLegacyFields?: boolean } = {},
): MastraMessageContentV2 | undefined {
  const nextContent = cloneContentWithoutLegacyFields(content);
  if (!nextContent) return nextContent;

  nextContent.parts =
    options.mergeLegacyFields === false ? getParts(content).map(clonePart) : updatePartsFromLegacyFields(content);

  return nextContent;
}

export function stripLegacyMessageFields<T extends MastraDBMessage>(message: T): T {
  if (!isMastraMessageContentV2(message.content)) {
    return { ...message };
  }

  return {
    ...message,
    content: getLegacyContentForStorage(message.content as MastraMessageContentV2WithLegacyFields, {
      mergeLegacyFields: false,
    }),
  };
}

export function stripLegacyMessageFieldsPreservingInstance<T extends MastraDBMessage>(message: T): T {
  if (!isMastraMessageContentV2(message.content)) return message;

  const nextContent = getLegacyContentForStorage(message.content as MastraMessageContentV2WithLegacyFields, {
    mergeLegacyFields: false,
  });
  message.content = nextContent as T['content'];
  return message;
}

export function stripLegacyMessageFieldsInPlace<T extends MastraDBMessage>(message: T): T {
  return stripLegacyMessageFieldsPreservingInstance(message);
}

export function stripLegacyMessagesFields<T extends MastraDBMessage>(messages: T[]): T[] {
  return messages.map(stripLegacyMessageFields);
}

export function addLegacyGettersToMessages<T extends MastraDBMessage>(messages: T[]): T[] {
  return messages.map(addLegacyGettersToMessage);
}

export function addLegacyGettersToContent<T extends MastraMessageContentV2>(content: T): T {
  if (!isMastraMessageContentV2(content)) return content;

  const target = content as T & MastraMessageContentV2WithLegacyFields;
  const descriptors = Object.getOwnPropertyDescriptors(target);

  if (!descriptors.content) {
    Object.defineProperty(target, 'content', {
      configurable: true,
      enumerable: false,
      get() {
        return getLegacyContent(target);
      },
    });
  }

  if (!descriptors.toolInvocations) {
    Object.defineProperty(target, 'toolInvocations', {
      configurable: true,
      enumerable: false,
      get() {
        return getLegacyToolInvocations(target);
      },
    });
  }

  if (!descriptors.reasoning) {
    Object.defineProperty(target, 'reasoning', {
      configurable: true,
      enumerable: false,
      get() {
        return getLegacyReasoning(target);
      },
    });
  }

  if (!descriptors.annotations) {
    Object.defineProperty(target, 'annotations', {
      configurable: true,
      enumerable: false,
      get() {
        return getLegacyAnnotations(target);
      },
    });
  }

  if (!descriptors.experimental_attachments) {
    Object.defineProperty(target, 'experimental_attachments', {
      configurable: true,
      enumerable: false,
      get() {
        return getLegacyExperimentalAttachments(target);
      },
    });
  }

  return target;
}

export function addLegacyGettersToMessage<T extends MastraDBMessage>(message: T): T {
  addLegacyGettersToContent(message.content);
  return message;
}

export function withLegacyGetters<T extends MastraDBMessage>(messages: T[]): T[] {
  return messages.map(addLegacyGettersToMessage);
}

export function hasLegacyMessageFields(content: MastraMessageContentV2WithLegacyFields): boolean {
  return legacyFieldNames.some(field => Object.prototype.propertyIsEnumerable.call(content, field));
}
