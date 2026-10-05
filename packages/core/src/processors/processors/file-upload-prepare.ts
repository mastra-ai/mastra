import { collect, describeError, describeFile, FILE_UPLOAD_ERROR_CODES, failed, ok } from './file-upload-errors';
import type { Result } from './file-upload-errors';
import { fileInfoOf } from './file-upload-file-info';
import type { FileUploadFileInfo } from './file-upload-file-info';
import { buildUploadPath } from './file-upload-filename';
import type { FileCandidate } from './file-upload-messages';
import { decodeInline, inlineDataOf } from './file-upload-source';

export type FileUploadMaxFileSize = (file: FileUploadFileInfo) => number;

/** A file whose bytes are loaded, checked, and ready to be written to the sandbox. */
export interface PreparedFile {
  candidate: FileCandidate;
  path: string;
  content: Buffer;
}

interface PlannedFile {
  candidate: FileCandidate;
  data: string;
  maxFileSize: number;
}

/**
 * Checks and decodes every file before the first write: one bad file stops the
 * whole turn, and nothing is decoded until every file has inline data and a limit.
 */
export function prepareFiles(
  candidates: FileCandidate[],
  maxFileSize: FileUploadMaxFileSize,
  threadId: string,
): Result<PreparedFile[]> {
  const planned = collect(candidates.map(candidate => planFile(candidate, maxFileSize)));
  if (!planned.ok) return planned;
  return collect(planned.value.map(file => loadPlannedFile(file, threadId)));
}

function planFile(candidate: FileCandidate, maxFileSize: FileUploadMaxFileSize): Result<PlannedFile> {
  const limit = resolveMaxFileSize(candidate, maxFileSize);
  if (!limit.ok) return limit;
  const data = inlineDataOf(candidate.data, fileDetails(candidate));
  if (!data.ok) return data;
  return ok({ candidate, data: data.value, maxFileSize: limit.value });
}

// `maxFileSize` is user code: a wrong value must stop the turn, not silently lift the limit.
function resolveMaxFileSize(candidate: FileCandidate, maxFileSize: FileUploadMaxFileSize): Result<number> {
  const { fileName, mimeType, data } = candidate;
  const invalid = (cause: string) =>
    failed(
      FILE_UPLOAD_ERROR_CODES.INVALID_MAX_FILE_SIZE,
      `maxFileSize must return a non-negative number of bytes; it did not for ${describeFile(fileName)}.`,
      { ...fileDetails(candidate), cause },
    );
  try {
    const limit = maxFileSize(fileInfoOf({ fileName, mimeType, data }));
    return typeof limit === 'number' && limit >= 0 ? ok(limit) : invalid(String(limit));
  } catch (error) {
    return invalid(describeError(error));
  }
}

function loadPlannedFile({ candidate, data, maxFileSize }: PlannedFile, threadId: string): Result<PreparedFile> {
  const content = decodeInline(data, fileDetails(candidate));
  if (!content.ok) return content;
  const size = content.value.byteLength;
  if (size > maxFileSize) {
    return failed(
      FILE_UPLOAD_ERROR_CODES.FILE_TOO_LARGE,
      `${describeFile(candidate.fileName)} is ${size} bytes, over the ${maxFileSize} byte limit.`,
      { ...fileDetails(candidate), size, maxFileSize },
    );
  }
  const path = buildUploadPath({ ...fileDetails(candidate), threadId, uuid: globalThis.crypto.randomUUID() });
  return ok({ candidate, path, content: content.value });
}

const fileDetails = ({ fileName, mimeType }: FileCandidate) => ({ fileName, mimeType });
