import { collect, describeError, describeFile, FILE_UPLOAD_ERROR_CODES, failed, ok } from './file-upload-errors';
import type { Result } from './file-upload-errors';
import { buildUploadPath } from './file-upload-filename';
import { extensionOf } from './file-upload-matching';
import type { FileCandidate } from './file-upload-messages';
import { classifySource, loadFileBytes } from './file-upload-source';
import type { FileSource } from './file-upload-source';

export interface FileUploadMaxFileSizeArgs {
  /** Name the file was sent with; `undefined` when it has none. */
  fileName?: string;
  mimeType: string;
  /** Lower-cased extension without the dot; `undefined` when the file has no name or no extension. */
  extension?: string;
}

export type FileUploadMaxFileSize = (file: FileUploadMaxFileSizeArgs) => number;

/** A file whose bytes are loaded, checked, and ready to be written to the sandbox. */
export interface PreparedFile {
  candidate: FileCandidate;
  path: string;
  content: Buffer;
}

interface PlannedFile {
  candidate: FileCandidate;
  source: FileSource;
  maxFileSize: number;
}

/**
 * Checks and loads every file before the first write: one bad file stops the
 * whole turn, and nothing is downloaded until every file has a usable source
 * and limit.
 */
export async function prepareFiles(
  candidates: FileCandidate[],
  maxFileSize: FileUploadMaxFileSize,
): Promise<Result<PreparedFile[]>> {
  const planned = collect(candidates.map(candidate => planFile(candidate, maxFileSize)));
  if (!planned.ok) return planned;
  return collect(await Promise.all(planned.value.map(loadPlannedFile)));
}

function planFile(candidate: FileCandidate, maxFileSize: FileUploadMaxFileSize): Result<PlannedFile> {
  const limit = resolveMaxFileSize(candidate, maxFileSize);
  if (!limit.ok) return limit;
  const source = classifySource(candidate.data, fileDetails(candidate));
  if (!source.ok) return source;
  return ok({ candidate, source: source.value, maxFileSize: limit.value });
}

// `maxFileSize` is user code: a wrong value must stop the turn, not silently lift the limit.
function resolveMaxFileSize(candidate: FileCandidate, maxFileSize: FileUploadMaxFileSize): Result<number> {
  const { fileName, mimeType } = candidate;
  const invalid = (cause: string) =>
    failed(
      FILE_UPLOAD_ERROR_CODES.INVALID_MAX_FILE_SIZE,
      `maxFileSize must return a non-negative number of bytes; it did not for ${describeFile(fileName)}.`,
      { ...fileDetails(candidate), cause },
    );
  try {
    const limit = maxFileSize({ fileName, mimeType, extension: extensionOf(fileName) });
    return typeof limit === 'number' && limit >= 0 ? ok(limit) : invalid(String(limit));
  } catch (error) {
    return invalid(describeError(error));
  }
}

async function loadPlannedFile({ candidate, source, maxFileSize }: PlannedFile): Promise<Result<PreparedFile>> {
  const content = await loadFileBytes(source, fileDetails(candidate));
  if (!content.ok) return content;
  const size = content.value.byteLength;
  if (size > maxFileSize) {
    return failed(
      FILE_UPLOAD_ERROR_CODES.FILE_TOO_LARGE,
      `${describeFile(candidate.fileName)} is ${size} bytes, over the ${maxFileSize} byte limit.`,
      { ...fileDetails(candidate), size, maxFileSize },
    );
  }
  const path = buildUploadPath(candidate.fileName, candidate.mimeType, globalThis.crypto.randomUUID());
  return ok({ candidate, path, content: content.value });
}

const fileDetails = ({ fileName, mimeType }: FileCandidate) => ({ fileName, mimeType });
