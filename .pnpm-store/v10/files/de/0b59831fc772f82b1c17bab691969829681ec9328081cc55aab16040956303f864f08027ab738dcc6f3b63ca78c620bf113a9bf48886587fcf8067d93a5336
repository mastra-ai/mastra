"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublishError = void 0;
/**
 * Exception to be thrown during failed ordered publish.
 *
 * @class
 * @extends Error
 */
class PublishError extends Error {
    code;
    details;
    metadata;
    orderingKey;
    error;
    constructor(key, err) {
        super(`Unable to publish for key "${key}". Reason: ${err.message}`);
        /**
         * The gRPC grpc.status code.
         *
         * @name PublishError#code
         * @type {number}
         */
        this.code = err.code;
        /**
         * The gRPC grpc.status details.
         *
         * @name PublishError#details
         * @type {string}
         */
        this.details = err.details;
        /**
         * The gRPC grpc.Metadata object.
         *
         * @name PublishError#grpc.Metadata
         * @type {object}
         */
        this.metadata = err.metadata;
        /**
         * The ordering key this failure occurred for.
         *
         * @name PublishError#orderingKey
         * @type {string}
         */
        this.orderingKey = key;
        /**
         * The original gRPC error.
         *
         * @name PublishError#error
         * @type {Error}
         */
        this.error = err;
    }
}
exports.PublishError = PublishError;
//# sourceMappingURL=publish-error.js.map