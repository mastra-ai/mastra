import { categorizeFileData, parseDataUri } from '../../agent/message-list/prompt/image-utils';
import { describeFile, FILE_UPLOAD_ERROR_CODES, failed, ok } from './file-upload-errors';
import type { FileUploadFailureDetails, Result } from './file-upload-errors';
import type { FileCandidate } from './file-upload-messages';

const BASE64 = /^[A-Za-z0-9+/_-]*={0,2}$/;
const BASE64_DATA_URI = /^data:[^,]*;base64,/i;

/** A file whose bytes were sent with the message, as base64 or a data URL. */
export type InlineFileCandidate = FileCandidate & { data: string };

/**
 * The processor only handles files sent inline. A URL or a provider file ID is
 * never fetched, so a server-side request can't be pointed at an internal
 * address: the file stays in the message and the model receives it as usual.
 */
export function isInline(candidate: FileCandidate): candidate is InlineFileCandidate {
  if (typeof candidate.data !== 'string') return false;
  const { type } = categorizeFileData(candidate.data);
  return type === 'dataUri' || type === 'raw';
}

/**
 * Decoded size of base64 data, computed without decoding it, so a file over its
 * limit is never loaded. `undefined` for a percent-encoded data URL, whose size
 * is only checked once decoded.
 */
export function base64SizeOf(data: string): number | undefined {
  const { isDataUri, base64Content } = parseDataUri(data);
  if (isDataUri && !BASE64_DATA_URI.test(data)) return undefined;
  return Buffer.byteLength(base64Content.replace(/\s+/g, ''), 'base64');
}

export function decodeInline(data: string, file: FileUploadFailureDetails): Result<Buffer> {
  const { isDataUri, base64Content } = parseDataUri(data);
  if (isDataUri && !data.includes(',')) return invalidData(file);
  const isPercentEncoded = isDataUri && !BASE64_DATA_URI.test(data);
  return isPercentEncoded ? decodePercentEncoded(base64Content, file) : decodeBase64(base64Content, file);
}

// `Buffer.from(..., 'base64')` drops what it cannot read, so the input is checked first.
function decodeBase64(content: string, file: FileUploadFailureDetails): Result<Buffer> {
  const compact = content.replace(/\s+/g, '');
  return BASE64.test(compact) ? ok(Buffer.from(compact, 'base64')) : invalidData(file);
}

function decodePercentEncoded(content: string, file: FileUploadFailureDetails): Result<Buffer> {
  try {
    return ok(Buffer.from(decodeURIComponent(content)));
  } catch {
    return invalidData(file);
  }
}

function invalidData(file: FileUploadFailureDetails): Result<never> {
  return failed(
    FILE_UPLOAD_ERROR_CODES.INVALID_FILE_DATA,
    `${describeFile(file.fileName)} has inline data that cannot be decoded.`,
    file,
  );
}
