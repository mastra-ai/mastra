import { extensionOf, normalizeMimeType } from './file-upload-matching';

const UPLOADS_DIRECTORY = 'uploads';

const FALLBACK_THREAD_DIRECTORY = 'thread';
const FALLBACK_DISPLAY_NAME = 'unnamed file';
const MAX_DIRECTORY_LENGTH = 100;
const MAX_EXTENSION_LENGTH = 16;
const MAX_DISPLAY_LENGTH = 200;

const ANSI_ESCAPE_SEQUENCES = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/g;
const DIACRITICS = /[̀-ͯ]/g;

/** Extensions for files sent without a name; anything else is written without one. */
const EXTENSIONS_BY_MIME_TYPE: Record<string, string> = {
  'application/json': 'json',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/zip': 'zip',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
  'text/csv': 'csv',
  'text/html': 'html',
  'text/markdown': 'md',
  'text/plain': 'txt',
  'video/mp4': 'mp4',
};

export interface UploadPathInput {
  /** Thread the file was sent in; each thread gets its own directory. */
  threadId: string;
  uuid: string;
  fileName?: string;
  mimeType: string;
}

/**
 * `uploads/<thread>/<uuid>.<ext>`. Nothing of the original name is kept but its
 * extension: a model shown a path that looks like the name can retype one from
 * the other, and ask the sandbox for a file that does not exist.
 */
export function buildUploadPath({ threadId, uuid, fileName, mimeType }: UploadPathInput): string {
  const extension = safeExtensionOf(fileName, mimeType);
  return `${UPLOADS_DIRECTORY}/${toSafeDirectory(threadId)}/${uuid}${extension ? `.${extension}` : ''}`;
}

/** The name as sent, minus anything that could forge lines or colors where it is displayed. */
export function toDisplayName(fileName: string | undefined): string {
  return stripUnprintable(fileName ?? '').slice(0, MAX_DISPLAY_LENGTH) || FALLBACK_DISPLAY_NAME;
}

// A file sent without a name takes its extension from its MIME type.
function safeExtensionOf(fileName: string | undefined, mimeType: string): string {
  const readable = stripUnprintable(fileName ?? '');
  if (!readable) return EXTENSIONS_BY_MIME_TYPE[normalizeMimeType(mimeType)] ?? '';
  return toSafeExtension(extensionOf(readable));
}

function stripUnprintable(value: string): string {
  return value.replace(ANSI_ESCAPE_SEQUENCES, '').replace(CONTROL_CHARACTERS, '');
}

// Only `[A-Za-z0-9._-]` survives, so the result is safe in a path and in a shell
// command. Path separators and `..` become `_`, which keeps the files in `uploads/`.
function toSafeDirectory(threadId: string): string {
  const safe = threadId
    .normalize('NFKD')
    .replace(DIACRITICS, '')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, MAX_DIRECTORY_LENGTH);
  return safe || FALLBACK_THREAD_DIRECTORY;
}

function toSafeExtension(extension: string | undefined): string {
  return (extension ?? '').replace(/[^a-z0-9]/g, '').slice(0, MAX_EXTENSION_LENGTH);
}
