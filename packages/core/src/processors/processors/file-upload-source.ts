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
 * Decoded size of inline data, computed from its encoded form without decoding
 * it, so a file over its limit is never loaded. Exact for valid data; invalid
 * data is still refused when it's decoded.
 */
export function decodedSizeOf(data: string): number {
  const { isDataUri, base64Content } = parseDataUri(data);
  if (isDataUri && !BASE64_DATA_URI.test(data)) return percentDecodedSizeOf(base64Content);
  return Buffer.byteLength(base64Content.replace(/\s+/g, ''), 'base64');
}

/**
 * Size in bytes of percent-encoded text once decoded, without decoding it.
 *
 * Decoding turns each `%XX` escape into exactly one byte, and every other
 * character into its UTF-8 bytes. Replacing each escape with a one-byte
 * placeholder and measuring the UTF-8 length therefore gives the same count:
 * `caf%C3%A9` becomes `caf__`, 5 bytes, like the decoded `café`.
 */
function percentDecodedSizeOf(content: string): number {
  return Buffer.byteLength(content.replace(/%[0-9a-f]{2}/gi, '_'), 'utf8');
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
