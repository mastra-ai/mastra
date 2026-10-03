import { downloadFromUrl } from '../../agent/message-list/prompt/download-assets';
import { categorizeFileData, parseDataUri } from '../../agent/message-list/prompt/image-utils';
import { describeError, describeFile, FILE_UPLOAD_ERROR_CODES, failed, ok } from './file-upload-errors';
import type { FileUploadFailureDetails, Result } from './file-upload-errors';

const DOWNLOAD_RETRIES = 3;
const BASE64 = /^[A-Za-z0-9+/_-]*={0,2}$/;
const BASE64_DATA_URI = /^data:[^,]*;base64,/i;
const HTTP_URL = /^https?:\/\//i;

export type FileSource = { kind: 'inline'; data: string } | { kind: 'remote'; url: URL };

/** Decides how the bytes can be obtained, before anything is decoded or downloaded. */
export function classifySource(data: unknown, file: FileUploadFailureDetails): Result<FileSource> {
  if (typeof data === 'string') {
    const { type } = categorizeFileData(data);
    if (type === 'dataUri' || type === 'raw') return ok({ kind: 'inline', data });
    if (type === 'url' && HTTP_URL.test(data)) return ok({ kind: 'remote', url: new URL(data) });
  }
  return failed(
    FILE_UPLOAD_ERROR_CODES.UNSUPPORTED_FILE_SOURCE,
    `${describeFile(file.fileName)} can only be uploaded from inline data or an http(s) URL.`,
    file,
  );
}

export async function loadFileBytes(source: FileSource, file: FileUploadFailureDetails): Promise<Result<Buffer>> {
  return source.kind === 'inline' ? decodeInline(source.data, file) : downloadRemote(source.url, file);
}

function decodeInline(data: string, file: FileUploadFailureDetails): Result<Buffer> {
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

async function downloadRemote(url: URL, file: FileUploadFailureDetails): Promise<Result<Buffer>> {
  try {
    const { data } = await downloadFromUrl({ url, downloadRetries: DOWNLOAD_RETRIES });
    return ok(Buffer.from(data));
  } catch (error) {
    return failed(
      FILE_UPLOAD_ERROR_CODES.FILE_DOWNLOAD_FAILED,
      `${describeFile(file.fileName)} could not be downloaded.`,
      { ...file, cause: describeError(error) },
    );
  }
}
