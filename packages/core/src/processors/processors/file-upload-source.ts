import { parseDataUri } from '../../agent/message-list/prompt/image-utils';
import { describeFile, FILE_UPLOAD_ERROR_CODES, failed, ok } from './file-upload-errors';
import type { FileUploadFailureDetails, Result } from './file-upload-errors';
import { sourceOf } from './file-upload-file-info';

const BASE64 = /^[A-Za-z0-9+/_-]*={0,2}$/;
const BASE64_DATA_URI = /^data:[^,]*;base64,/i;

/** The inline data of a file. A URL or a provider file ID is never fetched, so it can't be uploaded. */
export function inlineDataOf(data: unknown, file: FileUploadFailureDetails): Result<string> {
  if (typeof data === 'string' && sourceOf(data) === 'inline') return ok(data);
  return failed(
    FILE_UPLOAD_ERROR_CODES.UNSUPPORTED_FILE_SOURCE,
    `${describeFile(file.fileName)} can only be uploaded from inline data.`,
    file,
  );
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
