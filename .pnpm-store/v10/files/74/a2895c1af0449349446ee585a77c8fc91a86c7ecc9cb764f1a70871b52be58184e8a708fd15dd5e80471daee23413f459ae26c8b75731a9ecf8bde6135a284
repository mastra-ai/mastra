/**
 * Base error class for all Storage Vectors errors
 */
export class StorageVectorsError extends Error {
  protected __isStorageVectorsError = true

  constructor(message: string) {
    super(message)
    this.name = 'StorageVectorsError'
  }
}

/**
 * Type guard to check if an error is a StorageVectorsError
 * @param error - The error to check
 * @returns True if the error is a StorageVectorsError
 */
export function isStorageVectorsError(error: unknown): error is StorageVectorsError {
  return typeof error === 'object' && error !== null && '__isStorageVectorsError' in error
}

/**
 * API error returned from S3 Vectors service
 * Includes HTTP status code and service-specific error code
 */
export class StorageVectorsApiError extends StorageVectorsError {
  status: number
  statusCode: string

  constructor(message: string, status: number, statusCode: string) {
    super(message)
    this.name = 'StorageVectorsApiError'
    this.status = status
    this.statusCode = statusCode
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      statusCode: this.statusCode,
    }
  }
}

/**
 * Unknown error that doesn't match expected error patterns
 * Wraps the original error for debugging
 */
export class StorageVectorsUnknownError extends StorageVectorsError {
  originalError: unknown

  constructor(message: string, originalError: unknown) {
    super(message)
    this.name = 'StorageVectorsUnknownError'
    this.originalError = originalError
  }
}

/**
 * Error codes specific to S3 Vectors API
 * Maps AWS service errors to application-friendly error codes
 */
export enum StorageVectorsErrorCode {
  /** Internal server fault (HTTP 500) */
  InternalError = 'InternalError',
  /** Resource already exists / conflict (HTTP 409) */
  S3VectorConflictException = 'S3VectorConflictException',
  /** Resource not found (HTTP 404) */
  S3VectorNotFoundException = 'S3VectorNotFoundException',
  /** Delete bucket while not empty (HTTP 400) */
  S3VectorBucketNotEmpty = 'S3VectorBucketNotEmpty',
  /** Exceeds bucket quota/limit (HTTP 400) */
  S3VectorMaxBucketsExceeded = 'S3VectorMaxBucketsExceeded',
  /** Exceeds index quota/limit (HTTP 400) */
  S3VectorMaxIndexesExceeded = 'S3VectorMaxIndexesExceeded',
}
