export interface FileMatcherOptions {
  /** MIME types to upload. Case-insensitive; `image/*` matches a whole type. */
  mimeTypes?: string[];
  /** File extensions to upload, with or without the leading dot. Case-insensitive. */
  extensions?: string[];
  /** MIME types to never upload, written like `mimeTypes`. They win over `mimeTypes` and `extensions`. */
  excludeMimeTypes?: string[];
}

export interface MatchableFile {
  mimeType: string;
  fileName?: string;
}

export type FileMatcher = (file: MatchableFile) => boolean;

/**
 * A file matches on its MIME type OR its extension; with neither filter, every file matches.
 * A file of an excluded MIME type never matches.
 */
export function createFileMatcher({
  mimeTypes = [],
  extensions = [],
  excludeMimeTypes = [],
}: FileMatcherOptions): FileMatcher {
  const allowedMimeTypes = mimeTypes.map(normalizeMimeType);
  const allowedExtensions = new Set(extensions.map(normalizeExtension));
  const excludedMimeTypes = excludeMimeTypes.map(normalizeMimeType);
  const allowsEveryFile = allowedMimeTypes.length === 0 && allowedExtensions.size === 0;

  return ({ mimeType, fileName }) => {
    const normalizedMimeType = normalizeMimeType(mimeType);
    if (matchesMimeType(normalizedMimeType, excludedMimeTypes)) return false;
    if (allowsEveryFile) return true;
    const extension = extensionOf(fileName);
    return (
      matchesMimeType(normalizedMimeType, allowedMimeTypes) ||
      (extension !== undefined && allowedExtensions.has(extension))
    );
  };
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

function normalizeExtension(extension: string): string {
  return extension.trim().replace(/^\./, '').toLowerCase();
}

function matchesMimeType(mimeType: string, allowed: string[]): boolean {
  return allowed.some(pattern =>
    pattern.endsWith('/*') ? mimeType.startsWith(pattern.slice(0, -1)) : mimeType === pattern,
  );
}
