/** Every reason the file upload processor can stop a turn, as reported in the tripwire metadata. */
export const FILE_UPLOAD_ERROR_CODES = {
  /** The agent has no memory, the call has no thread, or memory is read-only. */
  MEMORY_REQUIRED: 'MEMORY_REQUIRED',
  /** The workspace has no sandbox, or resolved none for this request. */
  NO_SANDBOX: 'NO_SANDBOX',
  /** The sandbox supports neither `writeFiles` nor `executeCommand`. */
  NO_WRITE_CAPABILITY: 'NO_WRITE_CAPABILITY',
  /** `maxFileSize` threw, or returned something other than a non-negative number. */
  INVALID_MAX_FILE_SIZE: 'INVALID_MAX_FILE_SIZE',
  /** `filter` threw, or returned something other than `true` or `false`. */
  INVALID_FILTER: 'INVALID_FILTER',
  /** Inline file data could not be decoded. */
  INVALID_FILE_DATA: 'INVALID_FILE_DATA',
  /** A file is larger than the limit returned by `maxFileSize`. */
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  /** Writing to the sandbox failed. */
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  /** A file the filter accepts was still in the prompt right before the model call. */
  FILE_NOT_UPLOADED: 'FILE_NOT_UPLOADED',
} as const;

export type FileUploadErrorCode = (typeof FILE_UPLOAD_ERROR_CODES)[keyof typeof FILE_UPLOAD_ERROR_CODES];

/** Metadata attached to the tripwire when the file upload processor stops a turn. */
export interface FileUploadTripwireMetadata {
  processorId: 'file-upload';
  code: FileUploadErrorCode;
  /** Name of the file that caused the stop, when one did and it has a name. */
  fileName?: string;
  mimeType?: string;
  /** Size of the file in bytes. */
  size?: number;
  /** Limit the file was checked against, in bytes. */
  maxFileSize?: number;
  /** Underlying error message or offending value. */
  cause?: string;
  /** Sandbox paths that may still exist because cleanup after a failed upload did not succeed. */
  orphanPaths?: string[];
}

export type FileUploadFailureDetails = Omit<FileUploadTripwireMetadata, 'processorId' | 'code'>;

/**
 * Thrown by the steps of an upload and caught once by the processor, which
 * turns it into the tripwire. Never leaves the processor.
 */
export class FileUploadError extends Error {
  constructor(
    readonly code: FileUploadErrorCode,
    message: string,
    readonly details: FileUploadFailureDetails = {},
  ) {
    super(message);
    this.name = 'FileUploadError';
  }
}

export const describeError = (error: unknown): string => (error instanceof Error ? error.message : String(error));
