"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CookieJar = exports.TimeoutError = exports.AbortError = exports.Response = exports.Request = exports.Headers = exports.DataBody = exports.StreamBody = exports.JsonBody = exports.Body = exports.AbortController = exports.onPush = exports.disconnectAll = exports.disconnect = exports.fetch = exports.context = exports.setup = void 0;
const abort_1 = require("./lib/abort");
Object.defineProperty(exports, "AbortController", { enumerable: true, get: function () { return abort_1.AbortController; } });
const body_1 = require("./lib/body");
Object.defineProperty(exports, "Body", { enumerable: true, get: function () { return body_1.Body; } });
Object.defineProperty(exports, "DataBody", { enumerable: true, get: function () { return body_1.DataBody; } });
Object.defineProperty(exports, "JsonBody", { enumerable: true, get: function () { return body_1.JsonBody; } });
Object.defineProperty(exports, "StreamBody", { enumerable: true, get: function () { return body_1.StreamBody; } });
const context_1 = require("./lib/context");
const cookie_jar_1 = require("./lib/cookie-jar");
Object.defineProperty(exports, "CookieJar", { enumerable: true, get: function () { return cookie_jar_1.CookieJar; } });
const core_1 = require("./lib/core");
Object.defineProperty(exports, "AbortError", { enumerable: true, get: function () { return core_1.AbortError; } });
Object.defineProperty(exports, "TimeoutError", { enumerable: true, get: function () { return core_1.TimeoutError; } });
const headers_1 = require("./lib/headers");
Object.defineProperty(exports, "Headers", { enumerable: true, get: function () { return headers_1.Headers; } });
const request_1 = require("./lib/request");
Object.defineProperty(exports, "Request", { enumerable: true, get: function () { return request_1.Request; } });
const response_1 = require("./lib/response");
Object.defineProperty(exports, "Response", { enumerable: true, get: function () { return response_1.Response; } });
const defaultContext = new context_1.Context();
const setup = (opts) => defaultContext.setup(opts);
exports.setup = setup;
const fetch = (input, init) => defaultContext.fetch(input, init);
exports.fetch = fetch;
const disconnect = (url) => defaultContext.disconnect(url);
exports.disconnect = disconnect;
const disconnectAll = () => defaultContext.disconnectAll();
exports.disconnectAll = disconnectAll;
const onPush = (handler) => defaultContext.onPush(handler);
exports.onPush = onPush;
function context(opts) {
    const ctx = new context_1.Context(opts);
    return {
        disconnect: ctx.disconnect.bind(ctx),
        disconnectAll: ctx.disconnectAll.bind(ctx),
        fetch: ctx.fetch.bind(ctx),
        onPush: ctx.onPush.bind(ctx),
        setup: ctx.setup.bind(ctx),
    };
}
exports.context = context;
//# sourceMappingURL=index.js.map