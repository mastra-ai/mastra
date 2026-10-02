import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import type { MastraDBMessage, MessageList } from '../../agent/message-list';
import { resolveFilePartMediaTypeAndData } from '../../agent/message-list/prompt/image-utils';
import { toDisplayName } from './file-upload-filename';
import type { FileMatcher, MatchableFile } from './file-upload-matching';

type MessagePart = MastraDBMessage['content']['parts'][number];

/** A file found in a new user or signal message. */
export interface FileCandidate {
  message: MastraDBMessage;
  /** The file part to replace; absent when the file only exists as an attachment. */
  part?: MessagePart;
  data: unknown;
  mimeType: string;
  fileName?: string;
}

const UPLOAD_ROLES = new Set<string>(['user', 'signal']);
const DEFAULT_MIME_TYPE = 'application/octet-stream';

/** Notes that stand in for attachment-only files; they keep their order at the start of the message. */
const attachmentNotes = new WeakSet<MessagePart>();

/** Messages added during this request; recalled history is never included. */
export function listNewMessages(messageList: MessageList): MastraDBMessage[] {
  return messageList.getPersisted.input.db().filter(message => UPLOAD_ROLES.has(message.role));
}

export function collectCandidates(messages: MastraDBMessage[]): FileCandidate[] {
  return messages.flatMap(message => {
    const fromParts = candidatesFromParts(message);
    return [...fromParts, ...candidatesFromAttachments(message, new Set(fromParts.map(file => file.data)))];
  });
}

function candidatesFromParts(message: MastraDBMessage): FileCandidate[] {
  return message.content.parts.flatMap(part => {
    if (part.type !== 'file') return [];
    const { mediaType, data } = resolveFilePartMediaTypeAndData(part);
    const fileName = (part as { filename?: unknown }).filename;
    return [
      {
        message,
        part,
        data,
        mimeType: mediaType ?? DEFAULT_MIME_TYPE,
        fileName: typeof fileName === 'string' ? fileName : undefined,
      },
    ];
  });
}

// AI SDK v4 UI messages carry files only as attachments, with no file part.
function candidatesFromAttachments(message: MastraDBMessage, alreadyInParts: Set<unknown>): FileCandidate[] {
  return (message.content.experimental_attachments ?? [])
    .filter(attachment => !alreadyInParts.has(attachment.url))
    .map(attachment => ({
      message,
      data: attachment.url,
      mimeType: attachment.contentType ?? DEFAULT_MIME_TYPE,
      fileName: attachment.name,
    }));
}

/** Swaps the file for a text part, so the bytes can no longer reach the model. */
function replaceCandidate(candidate: FileCandidate, text: string): void {
  const { parts } = candidate.message.content;
  if (candidate.part) replacePart(parts, candidate.part, text);
  else insertAttachmentNote(parts, text);
  removeAttachmentsFor(candidate);
  syncTextMirror(candidate.message);
}

function replacePart(parts: MessagePart[], part: MessagePart, text: string): void {
  const index = parts.indexOf(part);
  if (index === -1) return;
  const createdAt = (part as { createdAt?: number }).createdAt;
  parts[index] = { type: 'text', text, ...(createdAt === undefined ? {} : { createdAt }) };
}

// An attachment has no position among the parts; the prompt puts attachments first, so do the notes.
function insertAttachmentNote(parts: MessagePart[], text: string): void {
  const note: MessagePart = { type: 'text', text };
  const firstOtherPart = parts.findIndex(part => !attachmentNotes.has(part));
  parts.splice(firstOtherPart === -1 ? parts.length : firstOtherPart, 0, note);
  attachmentNotes.add(note);
}

// The same bytes are mirrored in `experimental_attachments`; left in place they
// are turned back into a file part when the prompt is built.
function removeAttachmentsFor({ message, data }: FileCandidate): void {
  const attachments = message.content.experimental_attachments;
  if (!attachments) return;
  message.content.experimental_attachments = attachments.filter(attachment => attachment.url !== data);
}

function syncTextMirror(message: MastraDBMessage): void {
  if (typeof message.content.content !== 'string') return;
  message.content.content = message.content.parts.flatMap(part => (part.type === 'text' ? [part.text] : [])).join('\n');
}

/** What is recorded in the message metadata about an uploaded file. */
export interface FileUploadRecord {
  /** Name the file was sent with; absent when it had none. */
  name?: string;
  /** Path of the file in the sandbox, relative to its working directory. */
  path: string;
  mimeType: string;
  /** Size in bytes. */
  size: number;
}

/** Replaces the file with a note for the model and records the upload for clients. */
export function markUploaded(candidate: FileCandidate, upload: FileUploadRecord): void {
  replaceCandidate(candidate, formatUploadedNote(upload));
  const content = candidate.message.content;
  const previous = Array.isArray(content.metadata?.fileUploads) ? content.metadata.fileUploads : [];
  content.metadata = { ...content.metadata, fileUploads: [...previous, upload] };
}

/** Replaces the file with a note saying why it was not uploaded. */
export function markRejected(candidate: FileCandidate, reason: string): void {
  const note = ['[File not uploaded]', `name: ${toDisplayName(candidate.fileName)}`, `reason: ${reason}`].join('\n');
  replaceCandidate(candidate, note);
}

// The path comes first: it is the line the model has to copy exactly.
function formatUploadedNote(file: FileUploadRecord): string {
  return [
    '[File uploaded to the sandbox]',
    `path: ${file.path}`,
    `name: ${toDisplayName(file.name)}`,
    `type: ${file.mimeType}`,
    `size: ${file.size} bytes`,
  ].join('\n');
}

/** First file the user sent that matches the filters and is still in the prompt about to reach the model. */
export function findUnuploadedFile(prompt: LanguageModelV2Prompt, matches: FileMatcher): MatchableFile | undefined {
  for (const message of prompt) {
    if (message.role !== 'user') continue;
    for (const part of message.content) {
      if (part.type !== 'file') continue;
      const file = { fileName: part.filename, mimeType: part.mediaType };
      if (matches(file)) return file;
    }
  }
  return undefined;
}
