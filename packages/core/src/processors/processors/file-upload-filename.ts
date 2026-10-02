import { extensionOf, normalizeMimeType } from './file-upload-matching';

export const UPLOADS_DIRECTORY = 'uploads';

const FALLBACK_BASE = 'file';
const FALLBACK_DISPLAY_NAME = 'unnamed file';
const MAX_BASE_LENGTH = 100;
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

/** `uploads/<base>-<uuid>.<ext>`: the uuid keeps two uploads of the same name apart. */
export function buildUploadPath(fileName: string | undefined, mimeType: string, uuid: string): string {
  const { base, extension } = sanitizeFileName(fileName, mimeType);
  return `${UPLOADS_DIRECTORY}/${base}-${uuid}${extension ? `.${extension}` : ''}`;
}

/** The name as sent, minus anything that could forge lines or colors where it is displayed. */
export function toDisplayName(fileName: string | undefined): string {
  return stripUnprintable(fileName ?? '').slice(0, MAX_DISPLAY_LENGTH) || FALLBACK_DISPLAY_NAME;
}

function sanitizeFileName(fileName: string | undefined, mimeType: string): { base: string; extension: string } {
  const readable = stripUnprintable(fileName ?? '');
  if (!readable) {
    return { base: FALLBACK_BASE, extension: EXTENSIONS_BY_MIME_TYPE[normalizeMimeType(mimeType)] ?? '' };
  }
  const extension = extensionOf(readable);
  const stem = extension === undefined ? readable : readable.slice(0, readable.lastIndexOf('.'));
  return { base: toSafeBase(stem), extension: toSafeExtension(extension) };
}

function stripUnprintable(value: string): string {
  return value.replace(ANSI_ESCAPE_SEQUENCES, '').replace(CONTROL_CHARACTERS, '');
}

// Only `[A-Za-z0-9._-]` survives, so the result is safe in a path and in a shell
// command. Path separators and `..` become `_`, which keeps the file in `uploads/`.
function toSafeBase(stem: string): string {
  const safe = stem
    .normalize('NFKD')
    .replace(DIACRITICS, '')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, MAX_BASE_LENGTH);
  return safe || FALLBACK_BASE;
}

function toSafeExtension(extension: string | undefined): string {
  return (extension ?? '').replace(/[^a-z0-9]/g, '').slice(0, MAX_EXTENSION_LENGTH);
}
