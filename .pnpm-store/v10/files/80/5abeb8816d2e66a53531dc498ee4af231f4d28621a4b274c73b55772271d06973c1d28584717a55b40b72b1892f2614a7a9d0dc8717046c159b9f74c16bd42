"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageVectorsErrorCode = exports.StorageVectorsUnknownError = exports.StorageVectorsApiError = exports.StorageVectorsError = void 0;
exports.isStorageVectorsError = isStorageVectorsError;
/**
 * Base error class for all Storage Vectors errors
 */
class StorageVectorsError extends Error {
    constructor(message) {
        super(message);
        this.__isStorageVectorsError = true;
        this.name = 'StorageVectorsError';
    }
}
exports.StorageVectorsError = StorageVectorsError;
/**
 * Type guard to check if an error is a StorageVectorsError
 * @param error - The error to check
 * @returns True if the error is a StorageVectorsError
 */
function isStorageVectorsError(error) {
    return typeof error === 'object' && error !== null && '__isStorageVectorsError' in error;
}
/**
 * API error returned from S3 Vectors service
 * Includes HTTP status code and service-specific error code
 */
class StorageVectorsApiError extends StorageVectorsError {
    constructor(message, status, statusCode) {
        super(message);
        this.name = 'StorageVectorsApiError';
        this.status = status;
        this.statusCode = statusCode;
    }
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            status: this.status,
            statusCode: this.statusCode,
        };
    }
}
exports.StorageVectorsApiError = StorageVectorsApiError;
/**
 * Unknown error that doesn't match expected error patterns
 * Wraps the original error for debugging
 */
class StorageVectorsUnknownError extends StorageVectorsError {
    constructor(message, originalError) {
        super(message);
        this.name = 'StorageVectorsUnknownError';
        this.originalError = originalError;
    }
}
exports.StorageVectorsUnknownError = StorageVectorsUnknownError;
/**
 * Error codes specific to S3 Vectors API
 * Maps AWS service errors to application-friendly error codes
 */
var StorageVectorsErrorCode;
(function (StorageVectorsErrorCode) {
    /** Internal server fault (HTTP 500) */
    StorageVectorsErrorCode["InternalError"] = "InternalError";
    /** Resource already exists / conflict (HTTP 409) */
    StorageVectorsErrorCode["S3VectorConflictException"] = "S3VectorConflictException";
    /** Resource not found (HTTP 404) */
    StorageVectorsErrorCode["S3VectorNotFoundException"] = "S3VectorNotFoundException";
    /** Delete bucket while not empty (HTTP 400) */
    StorageVectorsErrorCode["S3VectorBucketNotEmpty"] = "S3VectorBucketNotEmpty";
    /** Exceeds bucket quota/limit (HTTP 400) */
    StorageVectorsErrorCode["S3VectorMaxBucketsExceeded"] = "S3VectorMaxBucketsExceeded";
    /** Exceeds index quota/limit (HTTP 400) */
    StorageVectorsErrorCode["S3VectorMaxIndexesExceeded"] = "S3VectorMaxIndexesExceeded";
})(StorageVectorsErrorCode || (exports.StorageVectorsErrorCode = StorageVectorsErrorCode = {}));
//# sourceMappingURL=errors.js.map