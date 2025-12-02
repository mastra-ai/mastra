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
exports.PineconeRequestError = exports.PineconeConnectionError = void 0;
var base_1 = require("./base");
/**
 * This error is thrown when the client attempts to make a
 * request and never receives any response.
 *
 * This could be due to:
 * - Network problems which prevent the request from being completed.
 * - An outage of Pinecone's APIs. See [Pinecone's status page](https://status.pinecone.io/) to find out whether there is an ongoing incident.
 *
 * The `cause` property will contain a reference to the underlying error. Inspect its value to find out more about the root cause of the error.
 * ```
 * import { Pinecone } from '@pinecone-database/pinecone';
 *
 * const p = new Pinecone({ apiKey: 'invalid-api-key-value' })
 *
 * try {
 *  await p.listIndexes();
 * } catch (e) {
 *  console.log(e.name); // PineconeConnectionError
 *  console.log(e.cause); // Error [FetchError]: The request failed and the interceptors did not return an alternative response
 *  console.log(e.cause.cause); // TypeError: fetch failed
 *  console.log(e.cause.cause.cause); // Error: getaddrinfo ENOTFOUND controller.wrong-environment.pinecone.io
 * }
 * ```
 *
 * @see [Pinecone's status page](https://status.pinecone.io/)
 * */
var PineconeConnectionError = /** @class */ (function (_super) {
    __extends(PineconeConnectionError, _super);
    function PineconeConnectionError(e, url) {
        var _this = this;
        var urlMessage = '';
        if (url) {
            urlMessage = " while calling ".concat(url);
        }
        _this = _super.call(this, "Request failed to reach Pinecone".concat(urlMessage, ". This can occur for reasons such as network problems that prevent the request from being completed, or a Pinecone API outage. Check your network connection, and visit https://status.pinecone.io/ to see whether any outages are ongoing."), e) || this;
        _this.name = 'PineconeConnectionError';
        return _this;
    }
    return PineconeConnectionError;
}(base_1.BasePineconeError));
exports.PineconeConnectionError = PineconeConnectionError;
/**
 * This error is thrown any time a request to the Pinecone API fails.
 *
 * The `cause` property will contain a reference to the underlying error. Inspect its value to find out more about the root cause.
 */
var PineconeRequestError = /** @class */ (function (_super) {
    __extends(PineconeRequestError, _super);
    function PineconeRequestError(context) {
        var _this = this;
        if (context.response) {
            _this = _super.call(this, "Request failed during a call to ".concat(context.init.method, " ").concat(context.url, " with status ").concat(context.response.status), context.error) || this;
        }
        else {
            _this = _super.call(this, "Request failed during a call to ".concat(context.init.method, " ").concat(context.url), context.error) || this;
        }
        return _this;
    }
    return PineconeRequestError;
}(base_1.BasePineconeError));
exports.PineconeRequestError = PineconeRequestError;
//# sourceMappingURL=request.js.map