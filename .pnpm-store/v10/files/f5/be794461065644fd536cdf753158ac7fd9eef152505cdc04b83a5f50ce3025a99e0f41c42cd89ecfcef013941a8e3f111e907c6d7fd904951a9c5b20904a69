"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapHttpStatusError = exports.PineconeUnmappedHttpError = exports.PineconeNotImplementedError = exports.PineconeInternalServerError = exports.PineconeConflictError = exports.PineconeNotFoundError = exports.PineconeAuthorizationError = exports.PineconeBadRequestError = void 0;
var base_1 = require("./base");
var CONFIG_HELP = "You can find the configuration values for your project in the Pinecone developer console at https://app.pinecone.io";
/** This error is thrown when API requests return with status 400. Typically this is due to some aspect of the request being incorrect or invalid.
 *
 * Some examples when this error could occur:
 * - While attempting to create an index with no available quota in your project.
 * - While upserting records that do not match the `dimension` of your index
 * - While attempting to create an index using an invalid name ("!@#$%")
 */
var PineconeBadRequestError = /** @class */ (function (_super) {
    __extends(PineconeBadRequestError, _super);
    function PineconeBadRequestError(failedRequest) {
        var _this = this;
        var message = failedRequest.message;
        _this = _super.call(this, message) || this;
        _this.name = 'PineconeBadRequestError';
        return _this;
    }
    return PineconeBadRequestError;
}(base_1.BasePineconeError));
exports.PineconeBadRequestError = PineconeBadRequestError;
/**
 * This error occurs when API requests are attempted using invalid configurations such as a mispelled or revoked API key.
 *
 * Log in to https://app.pinecone.io to verify you have configured the { @link Pinecone }
 * client using the correct values.
 */
var PineconeAuthorizationError = /** @class */ (function (_super) {
    __extends(PineconeAuthorizationError, _super);
    function PineconeAuthorizationError(failedRequest) {
        var _this = this;
        var url = failedRequest.url;
        if (url) {
            _this = _super.call(this, "The API key you provided was rejected while calling ".concat(url, ". Please check your configuration values and try again. ").concat(CONFIG_HELP)) || this;
        }
        else {
            _this = _super.call(this, "The API key you provided was rejected. Please check your configuration values and try again. ".concat(CONFIG_HELP)) || this;
        }
        _this.name = 'PineconeAuthorizationError';
        return _this;
    }
    return PineconeAuthorizationError;
}(base_1.BasePineconeError));
exports.PineconeAuthorizationError = PineconeAuthorizationError;
/**
 * This error is thrown when interacting with a resource such as an index or collection
 * that cannot be found.
 */
var PineconeNotFoundError = /** @class */ (function (_super) {
    __extends(PineconeNotFoundError, _super);
    function PineconeNotFoundError(failedRequest) {
        var _this = this;
        var url = failedRequest.url;
        if (url) {
            _this = _super.call(this, "A call to ".concat(url, " returned HTTP status 404.")) || this;
        }
        else {
            _this = _super.call(this, 'The requested resource could not be found.') || this;
        }
        _this.name = 'PineconeNotFoundError';
        return _this;
    }
    return PineconeNotFoundError;
}(base_1.BasePineconeError));
exports.PineconeNotFoundError = PineconeNotFoundError;
/**
 * This error is thrown when attempting to create a resource such as an index or
 * collection with a name that is already in use.
 * */
var PineconeConflictError = /** @class */ (function (_super) {
    __extends(PineconeConflictError, _super);
    function PineconeConflictError(failedRequest) {
        var _this = this;
        var url = failedRequest.url, message = failedRequest.message;
        if (url) {
            _this = _super.call(this, "A call to ".concat(url, " returned HTTP status 409. ").concat(message ? message : '')) || this;
        }
        else {
            _this = _super.call(this, 'The resource you are attempting to create already exists.') || this;
        }
        _this.name = 'PineconeConflictError';
        return _this;
    }
    return PineconeConflictError;
}(base_1.BasePineconeError));
exports.PineconeConflictError = PineconeConflictError;
/**
 * This error indicates API responses are returning with status 500 and
 * something is wrong with Pinecone. Check the [status page](https://status.pinecone.io/)
 * for information about current or recent outages.
 *
 * @see [Pinecone's status page](https://status.pinecone.io/)
 */
var PineconeInternalServerError = /** @class */ (function (_super) {
    __extends(PineconeInternalServerError, _super);
    function PineconeInternalServerError(failedRequest) {
        var _this = this;
        var url = failedRequest.url, body = failedRequest.body;
        var intro = url
            ? "An internal server error occured while calling the ".concat(url, " endpoint.")
            : '';
        var help = "To see overall service health and learn whether this seems like a large-scale problem or one specific to your request, please go to https://status.pinecone.io/ to view our status page. If you believe the error reflects a problem with this client, please file a bug report in the github issue tracker at https://github.com/pinecone-io/pinecone-ts-client";
        var bodyMessage = body ? "Body: ".concat(body) : '';
        _this = _super.call(this, [intro, help, bodyMessage].join(' ').trim()) || this;
        _this.name = 'PineconeInternalServerError';
        return _this;
    }
    return PineconeInternalServerError;
}(base_1.BasePineconeError));
exports.PineconeInternalServerError = PineconeInternalServerError;
/**
 * This error is thrown when you are attempting to use a feature that is
 * not implemented or unavailable to you on your current plan. Free indexes
 * only support a subset of Pinecone's capabilities, and if you are seeing
 * these exceptions then you should consult the
 * [pricing page](https://www.pinecone.io/pricing/) to see whether upgrading
 * makes sense for your use case.
 */
var PineconeNotImplementedError = /** @class */ (function (_super) {
    __extends(PineconeNotImplementedError, _super);
    function PineconeNotImplementedError(requestInfo) {
        var _this = this;
        var url = requestInfo.url, message = requestInfo.message;
        if (url) {
            _this = _super.call(this, "A call to ".concat(url, " returned HTTP status 501. ").concat(message ? message : '')) || this;
        }
        else {
            _this = _super.call(this) || this;
        }
        _this.name = 'PineconeNotImplementedError';
        return _this;
    }
    return PineconeNotImplementedError;
}(base_1.BasePineconeError));
exports.PineconeNotImplementedError = PineconeNotImplementedError;
/**
 * This catch-all exception is thrown when a request error that is not
 * specifically mapped to another exception is thrown.
 */
var PineconeUnmappedHttpError = /** @class */ (function (_super) {
    __extends(PineconeUnmappedHttpError, _super);
    function PineconeUnmappedHttpError(failedRequest) {
        var _this = this;
        var url = failedRequest.url, status = failedRequest.status, body = failedRequest.body, message = failedRequest.message;
        var intro = url
            ? "An unexpected error occured while calling the ".concat(url, " endpoint. ")
            : '';
        var statusMsg = status ? "Status: ".concat(status, ". ") : '';
        var bodyMsg = body ? "Body: ".concat(body) : '';
        _this = _super.call(this, [intro, message, statusMsg, bodyMsg].join(' ').trim()) || this;
        _this.name = 'PineconeUnmappedHttpError';
        return _this;
    }
    return PineconeUnmappedHttpError;
}(base_1.BasePineconeError));
exports.PineconeUnmappedHttpError = PineconeUnmappedHttpError;
/** @internal */
var mapHttpStatusError = function (failedRequestInfo) {
    switch (failedRequestInfo.status) {
        case 400:
            return new PineconeBadRequestError(failedRequestInfo);
        case 401:
            return new PineconeAuthorizationError(failedRequestInfo);
        case 403:
            return new PineconeBadRequestError(failedRequestInfo);
        case 404:
            return new PineconeNotFoundError(failedRequestInfo);
        case 409:
            return new PineconeConflictError(failedRequestInfo);
        case 500:
            return new PineconeInternalServerError(failedRequestInfo);
        case 501:
            return new PineconeNotImplementedError(failedRequestInfo);
        default:
            throw new PineconeUnmappedHttpError(failedRequestInfo);
    }
};
exports.mapHttpStatusError = mapHttpStatusError;
//# sourceMappingURL=http.js.map