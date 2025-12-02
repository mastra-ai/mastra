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
exports.PineconeUnableToResolveHostError = exports.PineconeEnvironmentVarsNotSupportedError = exports.PineconeUnexpectedResponseError = exports.PineconeConfigurationError = void 0;
var base_1 = require("./base");
var CONFIG_HELP = "You can find the configuration values for your project in the Pinecone developer console at https://app.pinecone.io.";
/**
 * This exception indicates there is a problem with the configuration values
 * you have provided to the client. The error message should contain additional
 * context about what you are missing.
 *
 * @see {@link Pinecone} for information about initializing the client.
 */
var PineconeConfigurationError = /** @class */ (function (_super) {
    __extends(PineconeConfigurationError, _super);
    function PineconeConfigurationError(message) {
        var _this = _super.call(this, "".concat(message, " ").concat(CONFIG_HELP)) || this;
        _this.name = 'PineconeConfigurationError';
        return _this;
    }
    return PineconeConfigurationError;
}(base_1.BasePineconeError));
exports.PineconeConfigurationError = PineconeConfigurationError;
/**
 * This exception indicates an API call that returned a response that was
 * unable to be parsed or that did not include expected fields. It's not
 * expected to ever occur.
 *
 * If you encounter this error, please [file an issue](https://github.com/pinecone-io/pinecone-ts-client/issues) so we can investigate.
 */
var PineconeUnexpectedResponseError = /** @class */ (function (_super) {
    __extends(PineconeUnexpectedResponseError, _super);
    function PineconeUnexpectedResponseError(url, status, body, message) {
        var _this = _super.call(this, "Unexpected response while calling ".concat(url, ". ").concat(message ? message + ' ' : '', "Status: ").concat(status, ". Body: ").concat(body)) || this;
        _this.name = 'PineconeUnexpectedResponseError';
        return _this;
    }
    return PineconeUnexpectedResponseError;
}(base_1.BasePineconeError));
exports.PineconeUnexpectedResponseError = PineconeUnexpectedResponseError;
/**
 * This error occurs when the client tries to read environment variables in
 * an environment that does not have access to the Node.js global `process.env`.
 *
 * If you are seeing this error, you will need to configure the client by passing
 * configuration values to the `Pinecone` constructor.
 *
 * ```typescript
 * import { Pinecone } from '@pinecone-database/pinecone';
 *
 * const pinecone = new Pinecone({
 *    apiKey: 'YOUR_API_KEY',
 * })
 * ```
 *
 * @see Instructions for configuring { @link Pinecone }
 */
var PineconeEnvironmentVarsNotSupportedError = /** @class */ (function (_super) {
    __extends(PineconeEnvironmentVarsNotSupportedError, _super);
    function PineconeEnvironmentVarsNotSupportedError(message) {
        var _this = _super.call(this, message) || this;
        _this.name = 'PineconeEnvironmentVarsNotSupportedError';
        return _this;
    }
    return PineconeEnvironmentVarsNotSupportedError;
}(base_1.BasePineconeError));
exports.PineconeEnvironmentVarsNotSupportedError = PineconeEnvironmentVarsNotSupportedError;
/**
 * This error occurs when the client is unable to resolve the database host for a given
 * index. This is unexpected to occur unless there is a problem with the Pinecone service.
 *
 * If you encounter this error, please [file an issue](https://github.com/pinecone-io/pinecone-ts-client/issues) so we can investigate.
 */
var PineconeUnableToResolveHostError = /** @class */ (function (_super) {
    __extends(PineconeUnableToResolveHostError, _super);
    function PineconeUnableToResolveHostError(message) {
        var _this = _super.call(this, message) || this;
        _this.name = 'PineconeUnableToResolveHostError';
        return _this;
    }
    return PineconeUnableToResolveHostError;
}(base_1.BasePineconeError));
exports.PineconeUnableToResolveHostError = PineconeUnableToResolveHostError;
//# sourceMappingURL=config.js.map