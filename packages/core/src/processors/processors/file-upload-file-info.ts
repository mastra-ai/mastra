/** What the processor knows about a file before reading its bytes. Passed to `filter` and `maxFileSize`. */
export interface FileUploadFileInfo {
  /** Name the file was sent with; `undefined` when it has none. */
  fileName?: string;
  /** MIME type in lower case and without parameters: `Text/Plain; charset=utf-8` becomes `text/plain`. */
  mimeType: string;
  /** Lower-cased extension without the dot; `undefined` when the file has no name or no extension. */
  extension?: string;
}

export function fileInfoOf({ fileName, mimeType }: { fileName?: string; mimeType: string }): FileUploadFileInfo {
  return { fileName, mimeType: normalizeMimeType(mimeType), extension: extensionOf(fileName) };
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
