import { categorizeFileData } from '../../agent/message-list/prompt/image-utils';

/**
 * Where the bytes of a file are. Only `inline` files can be uploaded: the
 * processor never downloads a URL, so a server-side request can't be pointed at
 * an internal address.
 */
export type FileUploadSource = 'inline' | 'url' | 'providerFileId';

/** What the processor knows about a file before reading its bytes. Passed to `filter` and `maxFileSize`. */
export interface FileUploadFileInfo {
  /** Name the file was sent with; `undefined` when it has none. */
  fileName?: string;
  /** MIME type in lower case and without parameters: `Text/Plain; charset=utf-8` becomes `text/plain`. */
  mimeType: string;
  /** Lower-cased extension without the dot; `undefined` when the file has no name or no extension. */
  extension?: string;
  /** `inline` for bytes sent with the message, `url` for a link, `providerFileId` for a model provider's file ID. */
  source: FileUploadSource;
}

export function fileInfoOf({
  fileName,
  mimeType,
  data,
}: {
  fileName?: string;
  mimeType: string;
  data: unknown;
}): FileUploadFileInfo {
  return { fileName, mimeType: normalizeMimeType(mimeType), extension: extensionOf(fileName), source: sourceOf(data) };
}

export function sourceOf(data: unknown): FileUploadSource {
  if (data instanceof URL) return 'url';
  if (typeof data !== 'string') return 'inline';
  const { type } = categorizeFileData(data);
  if (type === 'url' || type === 'providerFileId') return type;
  return 'inline';
}

/** Lower-cased extension of the last path segment, without the dot. */
export function extensionOf(fileName: string | undefined): string | undefined {
  const lastSegment = fileName?.split(/[\\/]/).pop() ?? '';
  const dotIndex = lastSegment.lastIndexOf('.');
  return dotIndex > 0 && dotIndex < lastSegment.length - 1 ? lastSegment.slice(dotIndex + 1).toLowerCase() : undefined;
}

/** `text/plain; charset=utf-8` is the same type as `text/plain`. */
export function normalizeMimeType(mimeType: string): string {
  return mimeType.split(';')[0]!.trim().toLowerCase();
}
