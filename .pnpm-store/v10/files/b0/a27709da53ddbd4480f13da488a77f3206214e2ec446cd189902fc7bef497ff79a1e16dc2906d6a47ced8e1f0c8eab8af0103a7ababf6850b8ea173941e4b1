/**
 * Base error class for all Storage Vectors errors
 */
export declare class StorageVectorsError extends Error {
    protected __isStorageVectorsError: boolean;
    constructor(message: string);
}
/**
 * Type guard to check if an error is a StorageVectorsError
 * @param error - The error to check
 * @returns True if the error is a StorageVectorsError
 */
export declare function isStorageVectorsError(error: unknown): error is StorageVectorsError;
/**
 * API error returned from S3 Vectors service
 * Includes HTTP status code and service-specific error code
 */
export declare class StorageVectorsApiError extends StorageVectorsError {
    status: number;
    statusCode: string;
    constructor(message: string, status: number, statusCode: string);
    toJSON(): {
        name: string;
        message: string;
        status: number;
        statusCode: string;
    };
}
/**
 * Unknown error that doesn't match expected error patterns
 * Wraps the original error for debugging
 */
export declare class StorageVectorsUnknownError extends StorageVectorsError {
    originalError: unknown;
    constructor(message: string, originalError: unknown);
}
/**
 * Error codes specific to S3 Vectors API
 * Maps AWS service errors to application-friendly error codes
 */
export declare enum StorageVectorsErrorCode {
    /** Internal server fault (HTTP 500) */
    InternalError = "InternalError",
    /** Resource already exists / conflict (HTTP 409) */
    S3VectorConflictException = "S3VectorConflictException",
    /** Resource not found (HTTP 404) */
    S3VectorNotFoundException = "S3VectorNotFoundException",
    /** Delete bucket while not empty (HTTP 400) */
    S3VectorBucketNotEmpty = "S3VectorBucketNotEmpty",
    /** Exceeds bucket quota/limit (HTTP 400) */
    S3VectorMaxBucketsExceeded = "S3VectorMaxBucketsExceeded",
    /** Exceeds index quota/limit (HTTP 400) */
    S3VectorMaxIndexesExceeded = "S3VectorMaxIndexesExceeded"
}
//# sourceMappingURL=errors.d.ts.map