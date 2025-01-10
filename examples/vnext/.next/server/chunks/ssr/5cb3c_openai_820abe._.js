module.exports = {

"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/version.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.VERSION = void 0;
exports.VERSION = '4.36.0'; // x-release-please-version
 //# sourceMappingURL=version.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/_shims/registry.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.setShims = exports.isFsReadStream = exports.fileFromPath = exports.getDefaultAgent = exports.getMultipartRequestOptions = exports.ReadableStream = exports.File = exports.Blob = exports.FormData = exports.Headers = exports.Response = exports.Request = exports.fetch = exports.kind = exports.auto = void 0;
exports.auto = false;
exports.kind = undefined;
exports.fetch = undefined;
exports.Request = undefined;
exports.Response = undefined;
exports.Headers = undefined;
exports.FormData = undefined;
exports.Blob = undefined;
exports.File = undefined;
exports.ReadableStream = undefined;
exports.getMultipartRequestOptions = undefined;
exports.getDefaultAgent = undefined;
exports.fileFromPath = undefined;
exports.isFsReadStream = undefined;
function setShims(shims, options = {
    auto: false
}) {
    if (exports.auto) {
        throw new Error(`you must \`import 'openai/shims/${shims.kind}'\` before importing anything else from openai`);
    }
    if (exports.kind) {
        throw new Error(`can't \`import 'openai/shims/${shims.kind}'\` after \`import 'openai/shims/${exports.kind}'\``);
    }
    exports.auto = options.auto;
    exports.kind = shims.kind;
    exports.fetch = shims.fetch;
    exports.Request = shims.Request;
    exports.Response = shims.Response;
    exports.Headers = shims.Headers;
    exports.FormData = shims.FormData;
    exports.Blob = shims.Blob;
    exports.File = shims.File;
    exports.ReadableStream = shims.ReadableStream;
    exports.getMultipartRequestOptions = shims.getMultipartRequestOptions;
    exports.getDefaultAgent = shims.getDefaultAgent;
    exports.fileFromPath = shims.fileFromPath;
    exports.isFsReadStream = shims.isFsReadStream;
}
exports.setShims = setShims; //# sourceMappingURL=registry.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/_shims/MultipartBody.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.MultipartBody = void 0;
/**
 * Disclaimer: modules in _shims aren't intended to be imported by SDK users.
 */ class MultipartBody {
    constructor(body){
        this.body = body;
    }
    get [Symbol.toStringTag]() {
        return 'MultipartBody';
    }
}
exports.MultipartBody = MultipartBody; //# sourceMappingURL=MultipartBody.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/_shims/node-runtime.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
var __createBinding = this && this.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = {
            enumerable: true,
            get: function() {
                return m[k];
            }
        };
    }
    Object.defineProperty(o, k2, desc);
} : function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
});
var __setModuleDefault = this && this.__setModuleDefault || (Object.create ? function(o, v) {
    Object.defineProperty(o, "default", {
        enumerable: true,
        value: v
    });
} : function(o, v) {
    o["default"] = v;
});
var __importStar = this && this.__importStar || function(mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) {
        for(var k in mod)if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    }
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = this && this.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : {
        "default": mod
    };
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.getRuntime = void 0;
/**
 * Disclaimer: modules in _shims aren't intended to be imported by SDK users.
 */ const nf = __importStar(__turbopack_require__("[project]/node_modules/.pnpm/node-fetch@2.7.0_encoding@0.1.13/node_modules/node-fetch/lib/index.mjs [app-rsc] (ecmascript)"));
const fd = __importStar(__turbopack_require__("[project]/node_modules/.pnpm/formdata-node@4.4.1/node_modules/formdata-node/lib/cjs/index.js [app-rsc] (ecmascript)"));
const agentkeepalive_1 = __importDefault(__turbopack_require__("[project]/node_modules/.pnpm/agentkeepalive@4.5.0/node_modules/agentkeepalive/index.js [app-rsc] (ecmascript)"));
const abort_controller_1 = __turbopack_require__("[project]/node_modules/.pnpm/abort-controller@3.0.0/node_modules/abort-controller/dist/abort-controller.js [app-rsc] (ecmascript)");
const node_fs_1 = __turbopack_require__("[externals]/ [external] (node:fs, cjs)");
const form_data_encoder_1 = __turbopack_require__("[project]/node_modules/.pnpm/form-data-encoder@1.7.2/node_modules/form-data-encoder/lib/cjs/index.js [app-rsc] (ecmascript)");
const node_stream_1 = __turbopack_require__("[externals]/ [external] (node:stream, cjs)");
const MultipartBody_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/_shims/MultipartBody.js [app-rsc] (ecmascript)");
// @ts-ignore (this package does not have proper export maps for this export)
const ponyfill_es2018_js_1 = __turbopack_require__("[project]/node_modules/.pnpm/web-streams-polyfill@3.3.3/node_modules/web-streams-polyfill/dist/ponyfill.es2018.js [app-rsc] (ecmascript)");
let fileFromPathWarned = false;
async function fileFromPath(path, ...args) {
    // this import fails in environments that don't handle export maps correctly, like old versions of Jest
    const { fileFromPath: _fileFromPath } = await Promise.resolve().then(()=>__importStar(__turbopack_require__("[project]/node_modules/.pnpm/formdata-node@4.4.1/node_modules/formdata-node/lib/cjs/fileFromPath.js [app-rsc] (ecmascript)")));
    if (!fileFromPathWarned) {
        console.warn(`fileFromPath is deprecated; use fs.createReadStream(${JSON.stringify(path)}) instead`);
        fileFromPathWarned = true;
    }
    // @ts-ignore
    return await _fileFromPath(path, ...args);
}
const defaultHttpAgent = new agentkeepalive_1.default({
    keepAlive: true,
    timeout: 5 * 60 * 1000
});
const defaultHttpsAgent = new agentkeepalive_1.default.HttpsAgent({
    keepAlive: true,
    timeout: 5 * 60 * 1000
});
async function getMultipartRequestOptions(form, opts) {
    const encoder = new form_data_encoder_1.FormDataEncoder(form);
    const readable = node_stream_1.Readable.from(encoder);
    const body = new MultipartBody_1.MultipartBody(readable);
    const headers = {
        ...opts.headers,
        ...encoder.headers,
        'Content-Length': encoder.contentLength
    };
    return {
        ...opts,
        body: body,
        headers
    };
}
function getRuntime() {
    // Polyfill global object if needed.
    if (typeof AbortController === 'undefined') {
        // @ts-expect-error (the types are subtly different, but compatible in practice)
        globalThis.AbortController = abort_controller_1.AbortController;
    }
    return {
        kind: 'node',
        fetch: nf.default,
        Request: nf.Request,
        Response: nf.Response,
        Headers: nf.Headers,
        FormData: fd.FormData,
        Blob: fd.Blob,
        File: fd.File,
        ReadableStream: ponyfill_es2018_js_1.ReadableStream,
        getMultipartRequestOptions,
        getDefaultAgent: (url)=>url.startsWith('https') ? defaultHttpsAgent : defaultHttpAgent,
        fileFromPath,
        isFsReadStream: (value)=>value instanceof node_fs_1.ReadStream
    };
}
exports.getRuntime = getRuntime; //# sourceMappingURL=node-runtime.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/_shims/auto/runtime-node.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
var __createBinding = this && this.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = {
            enumerable: true,
            get: function() {
                return m[k];
            }
        };
    }
    Object.defineProperty(o, k2, desc);
} : function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
});
var __exportStar = this && this.__exportStar || function(m, exports1) {
    for(var p in m)if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports1, p)) __createBinding(exports1, m, p);
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
/**
 * Disclaimer: modules in _shims aren't intended to be imported by SDK users.
 */ __exportStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/_shims/node-runtime.js [app-rsc] (ecmascript)"), exports); //# sourceMappingURL=runtime-node.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/_shims/index.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
/**
 * Disclaimer: modules in _shims aren't intended to be imported by SDK users.
 */ const shims = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/_shims/registry.js [app-rsc] (ecmascript)");
const auto = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/_shims/auto/runtime-node.js [app-rsc] (ecmascript)");
if (!shims.kind) shims.setShims(auto.getRuntime(), {
    auto: true
});
for (const property of Object.keys(shims)){
    Object.defineProperty(exports, property, {
        get () {
            return shims[property];
        }
    });
}
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/error.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.InternalServerError = exports.RateLimitError = exports.UnprocessableEntityError = exports.ConflictError = exports.NotFoundError = exports.PermissionDeniedError = exports.AuthenticationError = exports.BadRequestError = exports.APIConnectionTimeoutError = exports.APIConnectionError = exports.APIUserAbortError = exports.APIError = exports.OpenAIError = void 0;
const core_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/core.js [app-rsc] (ecmascript)");
class OpenAIError extends Error {
}
exports.OpenAIError = OpenAIError;
class APIError extends OpenAIError {
    constructor(status, error, message, headers){
        super(`${APIError.makeMessage(status, error, message)}`);
        this.status = status;
        this.headers = headers;
        this.request_id = headers?.['x-request-id'];
        const data = error;
        this.error = data;
        this.code = data?.['code'];
        this.param = data?.['param'];
        this.type = data?.['type'];
    }
    static makeMessage(status, error, message) {
        const msg = error?.message ? typeof error.message === 'string' ? error.message : JSON.stringify(error.message) : error ? JSON.stringify(error) : message;
        if (status && msg) {
            return `${status} ${msg}`;
        }
        if (status) {
            return `${status} status code (no body)`;
        }
        if (msg) {
            return msg;
        }
        return '(no status code or body)';
    }
    static generate(status, errorResponse, message, headers) {
        if (!status) {
            return new APIConnectionError({
                cause: (0, core_1.castToError)(errorResponse)
            });
        }
        const error = errorResponse?.['error'];
        if (status === 400) {
            return new BadRequestError(status, error, message, headers);
        }
        if (status === 401) {
            return new AuthenticationError(status, error, message, headers);
        }
        if (status === 403) {
            return new PermissionDeniedError(status, error, message, headers);
        }
        if (status === 404) {
            return new NotFoundError(status, error, message, headers);
        }
        if (status === 409) {
            return new ConflictError(status, error, message, headers);
        }
        if (status === 422) {
            return new UnprocessableEntityError(status, error, message, headers);
        }
        if (status === 429) {
            return new RateLimitError(status, error, message, headers);
        }
        if (status >= 500) {
            return new InternalServerError(status, error, message, headers);
        }
        return new APIError(status, error, message, headers);
    }
}
exports.APIError = APIError;
class APIUserAbortError extends APIError {
    constructor({ message } = {}){
        super(undefined, undefined, message || 'Request was aborted.', undefined);
        this.status = undefined;
    }
}
exports.APIUserAbortError = APIUserAbortError;
class APIConnectionError extends APIError {
    constructor({ message, cause }){
        super(undefined, undefined, message || 'Connection error.', undefined);
        this.status = undefined;
        // in some environments the 'cause' property is already declared
        // @ts-ignore
        if (cause) this.cause = cause;
    }
}
exports.APIConnectionError = APIConnectionError;
class APIConnectionTimeoutError extends APIConnectionError {
    constructor({ message } = {}){
        super({
            message: message ?? 'Request timed out.'
        });
    }
}
exports.APIConnectionTimeoutError = APIConnectionTimeoutError;
class BadRequestError extends APIError {
    constructor(){
        super(...arguments);
        this.status = 400;
    }
}
exports.BadRequestError = BadRequestError;
class AuthenticationError extends APIError {
    constructor(){
        super(...arguments);
        this.status = 401;
    }
}
exports.AuthenticationError = AuthenticationError;
class PermissionDeniedError extends APIError {
    constructor(){
        super(...arguments);
        this.status = 403;
    }
}
exports.PermissionDeniedError = PermissionDeniedError;
class NotFoundError extends APIError {
    constructor(){
        super(...arguments);
        this.status = 404;
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends APIError {
    constructor(){
        super(...arguments);
        this.status = 409;
    }
}
exports.ConflictError = ConflictError;
class UnprocessableEntityError extends APIError {
    constructor(){
        super(...arguments);
        this.status = 422;
    }
}
exports.UnprocessableEntityError = UnprocessableEntityError;
class RateLimitError extends APIError {
    constructor(){
        super(...arguments);
        this.status = 429;
    }
}
exports.RateLimitError = RateLimitError;
class InternalServerError extends APIError {
}
exports.InternalServerError = InternalServerError; //# sourceMappingURL=error.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/streaming.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.readableStreamAsyncIterable = exports._decodeChunks = exports._iterSSEMessages = exports.Stream = void 0;
const index_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/_shims/index.js [app-rsc] (ecmascript)");
const error_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/error.js [app-rsc] (ecmascript)");
const error_2 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/error.js [app-rsc] (ecmascript)");
class Stream {
    constructor(iterator, controller){
        this.iterator = iterator;
        this.controller = controller;
    }
    static fromSSEResponse(response, controller) {
        let consumed = false;
        async function* iterator() {
            if (consumed) {
                throw new Error('Cannot iterate over a consumed stream, use `.tee()` to split the stream.');
            }
            consumed = true;
            let done = false;
            try {
                for await (const sse of _iterSSEMessages(response, controller)){
                    if (done) continue;
                    if (sse.data.startsWith('[DONE]')) {
                        done = true;
                        continue;
                    }
                    if (sse.event === null) {
                        let data;
                        try {
                            data = JSON.parse(sse.data);
                        } catch (e) {
                            console.error(`Could not parse message into JSON:`, sse.data);
                            console.error(`From chunk:`, sse.raw);
                            throw e;
                        }
                        if (data && data.error) {
                            throw new error_2.APIError(undefined, data.error, undefined, undefined);
                        }
                        yield data;
                    } else {
                        let data;
                        try {
                            data = JSON.parse(sse.data);
                        } catch (e) {
                            console.error(`Could not parse message into JSON:`, sse.data);
                            console.error(`From chunk:`, sse.raw);
                            throw e;
                        }
                        // TODO: Is this where the error should be thrown?
                        if (sse.event == 'error') {
                            throw new error_2.APIError(undefined, data.error, data.message, undefined);
                        }
                        yield {
                            event: sse.event,
                            data: data
                        };
                    }
                }
                done = true;
            } catch (e) {
                // If the user calls `stream.controller.abort()`, we should exit without throwing.
                if (e instanceof Error && e.name === 'AbortError') return;
                throw e;
            } finally{
                // If the user `break`s, abort the ongoing request.
                if (!done) controller.abort();
            }
        }
        return new Stream(iterator, controller);
    }
    /**
     * Generates a Stream from a newline-separated ReadableStream
     * where each item is a JSON value.
     */ static fromReadableStream(readableStream, controller) {
        let consumed = false;
        async function* iterLines() {
            const lineDecoder = new LineDecoder();
            const iter = readableStreamAsyncIterable(readableStream);
            for await (const chunk of iter){
                for (const line of lineDecoder.decode(chunk)){
                    yield line;
                }
            }
            for (const line of lineDecoder.flush()){
                yield line;
            }
        }
        async function* iterator() {
            if (consumed) {
                throw new Error('Cannot iterate over a consumed stream, use `.tee()` to split the stream.');
            }
            consumed = true;
            let done = false;
            try {
                for await (const line of iterLines()){
                    if (done) continue;
                    if (line) yield JSON.parse(line);
                }
                done = true;
            } catch (e) {
                // If the user calls `stream.controller.abort()`, we should exit without throwing.
                if (e instanceof Error && e.name === 'AbortError') return;
                throw e;
            } finally{
                // If the user `break`s, abort the ongoing request.
                if (!done) controller.abort();
            }
        }
        return new Stream(iterator, controller);
    }
    [Symbol.asyncIterator]() {
        return this.iterator();
    }
    /**
     * Splits the stream into two streams which can be
     * independently read from at different speeds.
     */ tee() {
        const left = [];
        const right = [];
        const iterator = this.iterator();
        const teeIterator = (queue)=>{
            return {
                next: ()=>{
                    if (queue.length === 0) {
                        const result = iterator.next();
                        left.push(result);
                        right.push(result);
                    }
                    return queue.shift();
                }
            };
        };
        return [
            new Stream(()=>teeIterator(left), this.controller),
            new Stream(()=>teeIterator(right), this.controller)
        ];
    }
    /**
     * Converts this stream to a newline-separated ReadableStream of
     * JSON stringified values in the stream
     * which can be turned back into a Stream with `Stream.fromReadableStream()`.
     */ toReadableStream() {
        const self = this;
        let iter;
        const encoder = new TextEncoder();
        return new index_1.ReadableStream({
            async start () {
                iter = self[Symbol.asyncIterator]();
            },
            async pull (ctrl) {
                try {
                    const { value, done } = await iter.next();
                    if (done) return ctrl.close();
                    const bytes = encoder.encode(JSON.stringify(value) + '\n');
                    ctrl.enqueue(bytes);
                } catch (err) {
                    ctrl.error(err);
                }
            },
            async cancel () {
                await iter.return?.();
            }
        });
    }
}
exports.Stream = Stream;
async function* _iterSSEMessages(response, controller) {
    if (!response.body) {
        controller.abort();
        throw new error_1.OpenAIError(`Attempted to iterate over a response with no body`);
    }
    const sseDecoder = new SSEDecoder();
    const lineDecoder = new LineDecoder();
    const iter = readableStreamAsyncIterable(response.body);
    for await (const sseChunk of iterSSEChunks(iter)){
        for (const line of lineDecoder.decode(sseChunk)){
            const sse = sseDecoder.decode(line);
            if (sse) yield sse;
        }
    }
    for (const line of lineDecoder.flush()){
        const sse = sseDecoder.decode(line);
        if (sse) yield sse;
    }
}
exports._iterSSEMessages = _iterSSEMessages;
/**
 * Given an async iterable iterator, iterates over it and yields full
 * SSE chunks, i.e. yields when a double new-line is encountered.
 */ async function* iterSSEChunks(iterator) {
    let data = new Uint8Array();
    for await (const chunk of iterator){
        if (chunk == null) {
            continue;
        }
        const binaryChunk = chunk instanceof ArrayBuffer ? new Uint8Array(chunk) : typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk;
        let newData = new Uint8Array(data.length + binaryChunk.length);
        newData.set(data);
        newData.set(binaryChunk, data.length);
        data = newData;
        let patternIndex;
        while((patternIndex = findDoubleNewlineIndex(data)) !== -1){
            yield data.slice(0, patternIndex);
            data = data.slice(patternIndex);
        }
    }
    if (data.length > 0) {
        yield data;
    }
}
function findDoubleNewlineIndex(buffer) {
    // This function searches the buffer for the end patterns (\r\r, \n\n, \r\n\r\n)
    // and returns the index right after the first occurrence of any pattern,
    // or -1 if none of the patterns are found.
    const newline = 0x0a; // \n
    const carriage = 0x0d; // \r
    for(let i = 0; i < buffer.length - 2; i++){
        if (buffer[i] === newline && buffer[i + 1] === newline) {
            // \n\n
            return i + 2;
        }
        if (buffer[i] === carriage && buffer[i + 1] === carriage) {
            // \r\r
            return i + 2;
        }
        if (buffer[i] === carriage && buffer[i + 1] === newline && i + 3 < buffer.length && buffer[i + 2] === carriage && buffer[i + 3] === newline) {
            // \r\n\r\n
            return i + 4;
        }
    }
    return -1;
}
class SSEDecoder {
    constructor(){
        this.event = null;
        this.data = [];
        this.chunks = [];
    }
    decode(line) {
        if (line.endsWith('\r')) {
            line = line.substring(0, line.length - 1);
        }
        if (!line) {
            // empty line and we didn't previously encounter any messages
            if (!this.event && !this.data.length) return null;
            const sse = {
                event: this.event,
                data: this.data.join('\n'),
                raw: this.chunks
            };
            this.event = null;
            this.data = [];
            this.chunks = [];
            return sse;
        }
        this.chunks.push(line);
        if (line.startsWith(':')) {
            return null;
        }
        let [fieldname, _, value] = partition(line, ':');
        if (value.startsWith(' ')) {
            value = value.substring(1);
        }
        if (fieldname === 'event') {
            this.event = value;
        } else if (fieldname === 'data') {
            this.data.push(value);
        }
        return null;
    }
}
/**
 * A re-implementation of httpx's `LineDecoder` in Python that handles incrementally
 * reading lines from text.
 *
 * https://github.com/encode/httpx/blob/920333ea98118e9cf617f246905d7b202510941c/httpx/_decoders.py#L258
 */ class LineDecoder {
    constructor(){
        this.buffer = [];
        this.trailingCR = false;
    }
    decode(chunk) {
        let text = this.decodeText(chunk);
        if (this.trailingCR) {
            text = '\r' + text;
            this.trailingCR = false;
        }
        if (text.endsWith('\r')) {
            this.trailingCR = true;
            text = text.slice(0, -1);
        }
        if (!text) {
            return [];
        }
        const trailingNewline = LineDecoder.NEWLINE_CHARS.has(text[text.length - 1] || '');
        let lines = text.split(LineDecoder.NEWLINE_REGEXP);
        // if there is a trailing new line then the last entry will be an empty
        // string which we don't care about
        if (trailingNewline) {
            lines.pop();
        }
        if (lines.length === 1 && !trailingNewline) {
            this.buffer.push(lines[0]);
            return [];
        }
        if (this.buffer.length > 0) {
            lines = [
                this.buffer.join('') + lines[0],
                ...lines.slice(1)
            ];
            this.buffer = [];
        }
        if (!trailingNewline) {
            this.buffer = [
                lines.pop() || ''
            ];
        }
        return lines;
    }
    decodeText(bytes) {
        if (bytes == null) return '';
        if (typeof bytes === 'string') return bytes;
        // Node:
        if (typeof Buffer !== 'undefined') {
            if (bytes instanceof Buffer) {
                return bytes.toString();
            }
            if (bytes instanceof Uint8Array) {
                return Buffer.from(bytes).toString();
            }
            throw new error_1.OpenAIError(`Unexpected: received non-Uint8Array (${bytes.constructor.name}) stream chunk in an environment with a global "Buffer" defined, which this library assumes to be Node. Please report this error.`);
        }
        // Browser
        if (typeof TextDecoder !== 'undefined') {
            if (bytes instanceof Uint8Array || bytes instanceof ArrayBuffer) {
                this.textDecoder ?? (this.textDecoder = new TextDecoder('utf8'));
                return this.textDecoder.decode(bytes);
            }
            throw new error_1.OpenAIError(`Unexpected: received non-Uint8Array/ArrayBuffer (${bytes.constructor.name}) in a web platform. Please report this error.`);
        }
        throw new error_1.OpenAIError(`Unexpected: neither Buffer nor TextDecoder are available as globals. Please report this error.`);
    }
    flush() {
        if (!this.buffer.length && !this.trailingCR) {
            return [];
        }
        const lines = [
            this.buffer.join('')
        ];
        this.buffer = [];
        this.trailingCR = false;
        return lines;
    }
}
// prettier-ignore
LineDecoder.NEWLINE_CHARS = new Set([
    '\n',
    '\r'
]);
LineDecoder.NEWLINE_REGEXP = /\r\n|[\n\r]/g;
/** This is an internal helper function that's just used for testing */ function _decodeChunks(chunks) {
    const decoder = new LineDecoder();
    const lines = [];
    for (const chunk of chunks){
        lines.push(...decoder.decode(chunk));
    }
    return lines;
}
exports._decodeChunks = _decodeChunks;
function partition(str, delimiter) {
    const index = str.indexOf(delimiter);
    if (index !== -1) {
        return [
            str.substring(0, index),
            delimiter,
            str.substring(index + delimiter.length)
        ];
    }
    return [
        str,
        '',
        ''
    ];
}
/**
 * Most browsers don't yet have async iterable support for ReadableStream,
 * and Node has a very different way of reading bytes from its "ReadableStream".
 *
 * This polyfill was pulled from https://github.com/MattiasBuelens/web-streams-polyfill/pull/122#issuecomment-1627354490
 */ function readableStreamAsyncIterable(stream) {
    if (stream[Symbol.asyncIterator]) return stream;
    const reader = stream.getReader();
    return {
        async next () {
            try {
                const result = await reader.read();
                if (result?.done) reader.releaseLock(); // release lock when stream becomes closed
                return result;
            } catch (e) {
                reader.releaseLock(); // release lock when stream becomes errored
                throw e;
            }
        },
        async return () {
            const cancelPromise = reader.cancel();
            reader.releaseLock();
            await cancelPromise;
            return {
                done: true,
                value: undefined
            };
        },
        [Symbol.asyncIterator] () {
            return this;
        }
    };
}
exports.readableStreamAsyncIterable = readableStreamAsyncIterable; //# sourceMappingURL=streaming.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/uploads.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.createForm = exports.multipartFormRequestOptions = exports.maybeMultipartFormRequestOptions = exports.isMultipartBody = exports.toFile = exports.isUploadable = exports.isBlobLike = exports.isFileLike = exports.isResponseLike = exports.fileFromPath = void 0;
const index_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/_shims/index.js [app-rsc] (ecmascript)");
var index_2 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/_shims/index.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "fileFromPath", {
    enumerable: true,
    get: function() {
        return index_2.fileFromPath;
    }
});
const isResponseLike = (value)=>value != null && typeof value === 'object' && typeof value.url === 'string' && typeof value.blob === 'function';
exports.isResponseLike = isResponseLike;
const isFileLike = (value)=>value != null && typeof value === 'object' && typeof value.name === 'string' && typeof value.lastModified === 'number' && (0, exports.isBlobLike)(value);
exports.isFileLike = isFileLike;
/**
 * The BlobLike type omits arrayBuffer() because @types/node-fetch@^2.6.4 lacks it; but this check
 * adds the arrayBuffer() method type because it is available and used at runtime
 */ const isBlobLike = (value)=>value != null && typeof value === 'object' && typeof value.size === 'number' && typeof value.type === 'string' && typeof value.text === 'function' && typeof value.slice === 'function' && typeof value.arrayBuffer === 'function';
exports.isBlobLike = isBlobLike;
const isUploadable = (value)=>{
    return (0, exports.isFileLike)(value) || (0, exports.isResponseLike)(value) || (0, index_1.isFsReadStream)(value);
};
exports.isUploadable = isUploadable;
/**
 * Helper for creating a {@link File} to pass to an SDK upload method from a variety of different data formats
 * @param value the raw content of the file.  Can be an {@link Uploadable}, {@link BlobLikePart}, or {@link AsyncIterable} of {@link BlobLikePart}s
 * @param {string=} name the name of the file. If omitted, toFile will try to determine a file name from bits if possible
 * @param {Object=} options additional properties
 * @param {string=} options.type the MIME type of the content
 * @param {number=} options.lastModified the last modified timestamp
 * @returns a {@link File} with the given properties
 */ async function toFile(value, name, options) {
    // If it's a promise, resolve it.
    value = await value;
    // Use the file's options if there isn't one provided
    options ?? (options = (0, exports.isFileLike)(value) ? {
        lastModified: value.lastModified,
        type: value.type
    } : {});
    if ((0, exports.isResponseLike)(value)) {
        const blob = await value.blob();
        name || (name = new URL(value.url).pathname.split(/[\\/]/).pop() ?? 'unknown_file');
        return new index_1.File([
            blob
        ], name, options);
    }
    const bits = await getBytes(value);
    name || (name = getName(value) ?? 'unknown_file');
    if (!options.type) {
        const type = bits[0]?.type;
        if (typeof type === 'string') {
            options = {
                ...options,
                type
            };
        }
    }
    return new index_1.File(bits, name, options);
}
exports.toFile = toFile;
async function getBytes(value) {
    let parts = [];
    if (typeof value === 'string' || ArrayBuffer.isView(value) || // includes Uint8Array, Buffer, etc.
    value instanceof ArrayBuffer) {
        parts.push(value);
    } else if ((0, exports.isBlobLike)(value)) {
        parts.push(await value.arrayBuffer());
    } else if (isAsyncIterableIterator(value) // includes Readable, ReadableStream, etc.
    ) {
        for await (const chunk of value){
            parts.push(chunk); // TODO, consider validating?
        }
    } else {
        throw new Error(`Unexpected data type: ${typeof value}; constructor: ${value?.constructor?.name}; props: ${propsForError(value)}`);
    }
    return parts;
}
function propsForError(value) {
    const props = Object.getOwnPropertyNames(value);
    return `[${props.map((p)=>`"${p}"`).join(', ')}]`;
}
function getName(value) {
    return getStringFromMaybeBuffer(value.name) || getStringFromMaybeBuffer(value.filename) || // For fs.ReadStream
    getStringFromMaybeBuffer(value.path)?.split(/[\\/]/).pop();
}
const getStringFromMaybeBuffer = (x)=>{
    if (typeof x === 'string') return x;
    if (typeof Buffer !== 'undefined' && x instanceof Buffer) return String(x);
    return undefined;
};
const isAsyncIterableIterator = (value)=>value != null && typeof value === 'object' && typeof value[Symbol.asyncIterator] === 'function';
const isMultipartBody = (body)=>body && typeof body === 'object' && body.body && body[Symbol.toStringTag] === 'MultipartBody';
exports.isMultipartBody = isMultipartBody;
/**
 * Returns a multipart/form-data request if any part of the given request body contains a File / Blob value.
 * Otherwise returns the request as is.
 */ const maybeMultipartFormRequestOptions = async (opts)=>{
    if (!hasUploadableValue(opts.body)) return opts;
    const form = await (0, exports.createForm)(opts.body);
    return (0, index_1.getMultipartRequestOptions)(form, opts);
};
exports.maybeMultipartFormRequestOptions = maybeMultipartFormRequestOptions;
const multipartFormRequestOptions = async (opts)=>{
    const form = await (0, exports.createForm)(opts.body);
    return (0, index_1.getMultipartRequestOptions)(form, opts);
};
exports.multipartFormRequestOptions = multipartFormRequestOptions;
const createForm = async (body)=>{
    const form = new index_1.FormData();
    await Promise.all(Object.entries(body || {}).map(([key, value])=>addFormValue(form, key, value)));
    return form;
};
exports.createForm = createForm;
const hasUploadableValue = (value)=>{
    if ((0, exports.isUploadable)(value)) return true;
    if (Array.isArray(value)) return value.some(hasUploadableValue);
    if (value && typeof value === 'object') {
        for(const k in value){
            if (hasUploadableValue(value[k])) return true;
        }
    }
    return false;
};
const addFormValue = async (form, key, value)=>{
    if (value === undefined) return;
    if (value == null) {
        throw new TypeError(`Received null for "${key}"; to pass null in FormData, you must use the string 'null'`);
    }
    // TODO: make nested formats configurable
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        form.append(key, String(value));
    } else if ((0, exports.isUploadable)(value)) {
        const file = await toFile(value);
        form.append(key, file);
    } else if (Array.isArray(value)) {
        await Promise.all(value.map((entry)=>addFormValue(form, key + '[]', entry)));
    } else if (typeof value === 'object') {
        await Promise.all(Object.entries(value).map(([name, prop])=>addFormValue(form, `${key}[${name}]`, prop)));
    } else {
        throw new TypeError(`Invalid value given to form, expected a string, number, boolean, object, Array, File or Blob but got ${value} instead`);
    }
}; //# sourceMappingURL=uploads.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/core.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
var __classPrivateFieldSet = this && this.__classPrivateFieldSet || function(receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
};
var __classPrivateFieldGet = this && this.__classPrivateFieldGet || function(receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _AbstractPage_client;
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.isObj = exports.toBase64 = exports.getRequiredHeader = exports.isHeadersProtocol = exports.isRunningInBrowser = exports.debug = exports.hasOwn = exports.isEmptyObj = exports.maybeCoerceBoolean = exports.maybeCoerceFloat = exports.maybeCoerceInteger = exports.coerceBoolean = exports.coerceFloat = exports.coerceInteger = exports.readEnv = exports.ensurePresent = exports.castToError = exports.sleep = exports.safeJSON = exports.isRequestOptions = exports.createResponseHeaders = exports.PagePromise = exports.AbstractPage = exports.APIClient = exports.APIPromise = exports.createForm = exports.multipartFormRequestOptions = exports.maybeMultipartFormRequestOptions = void 0;
const version_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/version.js [app-rsc] (ecmascript)");
const streaming_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/streaming.js [app-rsc] (ecmascript)");
const error_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/error.js [app-rsc] (ecmascript)");
const index_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/_shims/index.js [app-rsc] (ecmascript)");
const uploads_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/uploads.js [app-rsc] (ecmascript)");
var uploads_2 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/uploads.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "maybeMultipartFormRequestOptions", {
    enumerable: true,
    get: function() {
        return uploads_2.maybeMultipartFormRequestOptions;
    }
});
Object.defineProperty(exports, "multipartFormRequestOptions", {
    enumerable: true,
    get: function() {
        return uploads_2.multipartFormRequestOptions;
    }
});
Object.defineProperty(exports, "createForm", {
    enumerable: true,
    get: function() {
        return uploads_2.createForm;
    }
});
async function defaultParseResponse(props) {
    const { response } = props;
    if (props.options.stream) {
        debug('response', response.status, response.url, response.headers, response.body);
        // Note: there is an invariant here that isn't represented in the type system
        // that if you set `stream: true` the response type must also be `Stream<T>`
        if (props.options.__streamClass) {
            return props.options.__streamClass.fromSSEResponse(response, props.controller);
        }
        return streaming_1.Stream.fromSSEResponse(response, props.controller);
    }
    // fetch refuses to read the body when the status code is 204.
    if (response.status === 204) {
        return null;
    }
    if (props.options.__binaryResponse) {
        return response;
    }
    const contentType = response.headers.get('content-type');
    const isJSON = contentType?.includes('application/json') || contentType?.includes('application/vnd.api+json');
    if (isJSON) {
        const json = await response.json();
        debug('response', response.status, response.url, response.headers, json);
        return json;
    }
    const text = await response.text();
    debug('response', response.status, response.url, response.headers, text);
    // TODO handle blob, arraybuffer, other content types, etc.
    return text;
}
/**
 * A subclass of `Promise` providing additional helper methods
 * for interacting with the SDK.
 */ class APIPromise extends Promise {
    constructor(responsePromise, parseResponse = defaultParseResponse){
        super((resolve)=>{
            // this is maybe a bit weird but this has to be a no-op to not implicitly
            // parse the response body; instead .then, .catch, .finally are overridden
            // to parse the response
            resolve(null);
        });
        this.responsePromise = responsePromise;
        this.parseResponse = parseResponse;
    }
    _thenUnwrap(transform) {
        return new APIPromise(this.responsePromise, async (props)=>transform(await this.parseResponse(props)));
    }
    /**
     * Gets the raw `Response` instance instead of parsing the response
     * data.
     *
     * If you want to parse the response body but still get the `Response`
     * instance, you can use {@link withResponse()}.
     *
     * 👋 Getting the wrong TypeScript type for `Response`?
     * Try setting `"moduleResolution": "NodeNext"` if you can,
     * or add one of these imports before your first `import … from 'openai'`:
     * - `import 'openai/shims/node'` (if you're running on Node)
     * - `import 'openai/shims/web'` (otherwise)
     */ asResponse() {
        return this.responsePromise.then((p)=>p.response);
    }
    /**
     * Gets the parsed response data and the raw `Response` instance.
     *
     * If you just want to get the raw `Response` instance without parsing it,
     * you can use {@link asResponse()}.
     *
     *
     * 👋 Getting the wrong TypeScript type for `Response`?
     * Try setting `"moduleResolution": "NodeNext"` if you can,
     * or add one of these imports before your first `import … from 'openai'`:
     * - `import 'openai/shims/node'` (if you're running on Node)
     * - `import 'openai/shims/web'` (otherwise)
     */ async withResponse() {
        const [data, response] = await Promise.all([
            this.parse(),
            this.asResponse()
        ]);
        return {
            data,
            response
        };
    }
    parse() {
        if (!this.parsedPromise) {
            this.parsedPromise = this.responsePromise.then(this.parseResponse);
        }
        return this.parsedPromise;
    }
    then(onfulfilled, onrejected) {
        return this.parse().then(onfulfilled, onrejected);
    }
    catch(onrejected) {
        return this.parse().catch(onrejected);
    }
    finally(onfinally) {
        return this.parse().finally(onfinally);
    }
}
exports.APIPromise = APIPromise;
class APIClient {
    constructor({ baseURL, maxRetries = 2, timeout = 600000, httpAgent, fetch: overridenFetch }){
        this.baseURL = baseURL;
        this.maxRetries = validatePositiveInteger('maxRetries', maxRetries);
        this.timeout = validatePositiveInteger('timeout', timeout);
        this.httpAgent = httpAgent;
        this.fetch = overridenFetch ?? index_1.fetch;
    }
    authHeaders(opts) {
        return {};
    }
    /**
     * Override this to add your own default headers, for example:
     *
     *  {
     *    ...super.defaultHeaders(),
     *    Authorization: 'Bearer 123',
     *  }
     */ defaultHeaders(opts) {
        return {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': this.getUserAgent(),
            ...getPlatformHeaders(),
            ...this.authHeaders(opts)
        };
    }
    /**
     * Override this to add your own headers validation:
     */ validateHeaders(headers, customHeaders) {}
    defaultIdempotencyKey() {
        return `stainless-node-retry-${uuid4()}`;
    }
    get(path, opts) {
        return this.methodRequest('get', path, opts);
    }
    post(path, opts) {
        return this.methodRequest('post', path, opts);
    }
    patch(path, opts) {
        return this.methodRequest('patch', path, opts);
    }
    put(path, opts) {
        return this.methodRequest('put', path, opts);
    }
    delete(path, opts) {
        return this.methodRequest('delete', path, opts);
    }
    methodRequest(method, path, opts) {
        return this.request(Promise.resolve(opts).then((opts)=>({
                method,
                path,
                ...opts
            })));
    }
    getAPIList(path, Page, opts) {
        return this.requestAPIList(Page, {
            method: 'get',
            path,
            ...opts
        });
    }
    calculateContentLength(body) {
        if (typeof body === 'string') {
            if (typeof Buffer !== 'undefined') {
                return Buffer.byteLength(body, 'utf8').toString();
            }
            if (typeof TextEncoder !== 'undefined') {
                const encoder = new TextEncoder();
                const encoded = encoder.encode(body);
                return encoded.length.toString();
            }
        }
        return null;
    }
    buildRequest(options) {
        const { method, path, query, headers: headers = {} } = options;
        const body = (0, uploads_1.isMultipartBody)(options.body) ? options.body.body : options.body ? JSON.stringify(options.body, null, 2) : null;
        const contentLength = this.calculateContentLength(body);
        const url = this.buildURL(path, query);
        if ('timeout' in options) validatePositiveInteger('timeout', options.timeout);
        const timeout = options.timeout ?? this.timeout;
        const httpAgent = options.httpAgent ?? this.httpAgent ?? (0, index_1.getDefaultAgent)(url);
        const minAgentTimeout = timeout + 1000;
        if (typeof httpAgent?.options?.timeout === 'number' && minAgentTimeout > (httpAgent.options.timeout ?? 0)) {
            // Allow any given request to bump our agent active socket timeout.
            // This may seem strange, but leaking active sockets should be rare and not particularly problematic,
            // and without mutating agent we would need to create more of them.
            // This tradeoff optimizes for performance.
            httpAgent.options.timeout = minAgentTimeout;
        }
        if (this.idempotencyHeader && method !== 'get') {
            if (!options.idempotencyKey) options.idempotencyKey = this.defaultIdempotencyKey();
            headers[this.idempotencyHeader] = options.idempotencyKey;
        }
        const reqHeaders = this.buildHeaders({
            options,
            headers,
            contentLength
        });
        const req = {
            method,
            ...body && {
                body: body
            },
            headers: reqHeaders,
            ...httpAgent && {
                agent: httpAgent
            },
            // @ts-ignore node-fetch uses a custom AbortSignal type that is
            // not compatible with standard web types
            signal: options.signal ?? null
        };
        return {
            req,
            url,
            timeout
        };
    }
    buildHeaders({ options, headers, contentLength }) {
        const reqHeaders = {};
        if (contentLength) {
            reqHeaders['content-length'] = contentLength;
        }
        const defaultHeaders = this.defaultHeaders(options);
        applyHeadersMut(reqHeaders, defaultHeaders);
        applyHeadersMut(reqHeaders, headers);
        // let builtin fetch set the Content-Type for multipart bodies
        if ((0, uploads_1.isMultipartBody)(options.body) && index_1.kind !== 'node') {
            delete reqHeaders['content-type'];
        }
        this.validateHeaders(reqHeaders, headers);
        return reqHeaders;
    }
    /**
     * Used as a callback for mutating the given `FinalRequestOptions` object.
     */ async prepareOptions(options) {}
    /**
     * Used as a callback for mutating the given `RequestInit` object.
     *
     * This is useful for cases where you want to add certain headers based off of
     * the request properties, e.g. `method` or `url`.
     */ async prepareRequest(request, { url, options }) {}
    parseHeaders(headers) {
        return !headers ? {} : Symbol.iterator in headers ? Object.fromEntries(Array.from(headers).map((header)=>[
                ...header
            ])) : {
            ...headers
        };
    }
    makeStatusError(status, error, message, headers) {
        return error_1.APIError.generate(status, error, message, headers);
    }
    request(options, remainingRetries = null) {
        return new APIPromise(this.makeRequest(options, remainingRetries));
    }
    async makeRequest(optionsInput, retriesRemaining) {
        const options = await optionsInput;
        if (retriesRemaining == null) {
            retriesRemaining = options.maxRetries ?? this.maxRetries;
        }
        await this.prepareOptions(options);
        const { req, url, timeout } = this.buildRequest(options);
        await this.prepareRequest(req, {
            url,
            options
        });
        debug('request', url, options, req.headers);
        if (options.signal?.aborted) {
            throw new error_1.APIUserAbortError();
        }
        const controller = new AbortController();
        const response = await this.fetchWithTimeout(url, req, timeout, controller).catch(exports.castToError);
        if (response instanceof Error) {
            if (options.signal?.aborted) {
                throw new error_1.APIUserAbortError();
            }
            if (retriesRemaining) {
                return this.retryRequest(options, retriesRemaining);
            }
            if (response.name === 'AbortError') {
                throw new error_1.APIConnectionTimeoutError();
            }
            throw new error_1.APIConnectionError({
                cause: response
            });
        }
        const responseHeaders = (0, exports.createResponseHeaders)(response.headers);
        if (!response.ok) {
            if (retriesRemaining && this.shouldRetry(response)) {
                const retryMessage = `retrying, ${retriesRemaining} attempts remaining`;
                debug(`response (error; ${retryMessage})`, response.status, url, responseHeaders);
                return this.retryRequest(options, retriesRemaining, responseHeaders);
            }
            const errText = await response.text().catch((e)=>(0, exports.castToError)(e).message);
            const errJSON = (0, exports.safeJSON)(errText);
            const errMessage = errJSON ? undefined : errText;
            const retryMessage = retriesRemaining ? `(error; no more retries left)` : `(error; not retryable)`;
            debug(`response (error; ${retryMessage})`, response.status, url, responseHeaders, errMessage);
            const err = this.makeStatusError(response.status, errJSON, errMessage, responseHeaders);
            throw err;
        }
        return {
            response,
            options,
            controller
        };
    }
    requestAPIList(Page, options) {
        const request = this.makeRequest(options, null);
        return new PagePromise(this, request, Page);
    }
    buildURL(path, query) {
        const url = isAbsoluteURL(path) ? new URL(path) : new URL(this.baseURL + (this.baseURL.endsWith('/') && path.startsWith('/') ? path.slice(1) : path));
        const defaultQuery = this.defaultQuery();
        if (!isEmptyObj(defaultQuery)) {
            query = {
                ...defaultQuery,
                ...query
            };
        }
        if (typeof query === 'object' && query && !Array.isArray(query)) {
            url.search = this.stringifyQuery(query);
        }
        return url.toString();
    }
    stringifyQuery(query) {
        return Object.entries(query).filter(([_, value])=>typeof value !== 'undefined').map(([key, value])=>{
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
            }
            if (value === null) {
                return `${encodeURIComponent(key)}=`;
            }
            throw new error_1.OpenAIError(`Cannot stringify type ${typeof value}; Expected string, number, boolean, or null. If you need to pass nested query parameters, you can manually encode them, e.g. { query: { 'foo[key1]': value1, 'foo[key2]': value2 } }, and please open a GitHub issue requesting better support for your use case.`);
        }).join('&');
    }
    async fetchWithTimeout(url, init, ms, controller) {
        const { signal, ...options } = init || {};
        if (signal) signal.addEventListener('abort', ()=>controller.abort());
        const timeout = setTimeout(()=>controller.abort(), ms);
        return this.getRequestClient()// use undefined this binding; fetch errors if bound to something else in browser/cloudflare
        .fetch.call(undefined, url, {
            signal: controller.signal,
            ...options
        }).finally(()=>{
            clearTimeout(timeout);
        });
    }
    getRequestClient() {
        return {
            fetch: this.fetch
        };
    }
    shouldRetry(response) {
        // Note this is not a standard header.
        const shouldRetryHeader = response.headers.get('x-should-retry');
        // If the server explicitly says whether or not to retry, obey.
        if (shouldRetryHeader === 'true') return true;
        if (shouldRetryHeader === 'false') return false;
        // Retry on request timeouts.
        if (response.status === 408) return true;
        // Retry on lock timeouts.
        if (response.status === 409) return true;
        // Retry on rate limits.
        if (response.status === 429) return true;
        // Retry internal errors.
        if (response.status >= 500) return true;
        return false;
    }
    async retryRequest(options, retriesRemaining, responseHeaders) {
        let timeoutMillis;
        // Note the `retry-after-ms` header may not be standard, but is a good idea and we'd like proactive support for it.
        const retryAfterMillisHeader = responseHeaders?.['retry-after-ms'];
        if (retryAfterMillisHeader) {
            const timeoutMs = parseFloat(retryAfterMillisHeader);
            if (!Number.isNaN(timeoutMs)) {
                timeoutMillis = timeoutMs;
            }
        }
        // About the Retry-After header: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After
        const retryAfterHeader = responseHeaders?.['retry-after'];
        if (retryAfterHeader && !timeoutMillis) {
            const timeoutSeconds = parseFloat(retryAfterHeader);
            if (!Number.isNaN(timeoutSeconds)) {
                timeoutMillis = timeoutSeconds * 1000;
            } else {
                timeoutMillis = Date.parse(retryAfterHeader) - Date.now();
            }
        }
        // If the API asks us to wait a certain amount of time (and it's a reasonable amount),
        // just do what it says, but otherwise calculate a default
        if (!(timeoutMillis && 0 <= timeoutMillis && timeoutMillis < 60 * 1000)) {
            const maxRetries = options.maxRetries ?? this.maxRetries;
            timeoutMillis = this.calculateDefaultRetryTimeoutMillis(retriesRemaining, maxRetries);
        }
        await (0, exports.sleep)(timeoutMillis);
        return this.makeRequest(options, retriesRemaining - 1);
    }
    calculateDefaultRetryTimeoutMillis(retriesRemaining, maxRetries) {
        const initialRetryDelay = 0.5;
        const maxRetryDelay = 8.0;
        const numRetries = maxRetries - retriesRemaining;
        // Apply exponential backoff, but not more than the max.
        const sleepSeconds = Math.min(initialRetryDelay * Math.pow(2, numRetries), maxRetryDelay);
        // Apply some jitter, take up to at most 25 percent of the retry time.
        const jitter = 1 - Math.random() * 0.25;
        return sleepSeconds * jitter * 1000;
    }
    getUserAgent() {
        return `${this.constructor.name}/JS ${version_1.VERSION}`;
    }
}
exports.APIClient = APIClient;
class AbstractPage {
    constructor(client, response, body, options){
        _AbstractPage_client.set(this, void 0);
        __classPrivateFieldSet(this, _AbstractPage_client, client, "f");
        this.options = options;
        this.response = response;
        this.body = body;
    }
    hasNextPage() {
        const items = this.getPaginatedItems();
        if (!items.length) return false;
        return this.nextPageInfo() != null;
    }
    async getNextPage() {
        const nextInfo = this.nextPageInfo();
        if (!nextInfo) {
            throw new error_1.OpenAIError('No next page expected; please check `.hasNextPage()` before calling `.getNextPage()`.');
        }
        const nextOptions = {
            ...this.options
        };
        if ('params' in nextInfo && typeof nextOptions.query === 'object') {
            nextOptions.query = {
                ...nextOptions.query,
                ...nextInfo.params
            };
        } else if ('url' in nextInfo) {
            const params = [
                ...Object.entries(nextOptions.query || {}),
                ...nextInfo.url.searchParams.entries()
            ];
            for (const [key, value] of params){
                nextInfo.url.searchParams.set(key, value);
            }
            nextOptions.query = undefined;
            nextOptions.path = nextInfo.url.toString();
        }
        return await __classPrivateFieldGet(this, _AbstractPage_client, "f").requestAPIList(this.constructor, nextOptions);
    }
    async *iterPages() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let page = this;
        yield page;
        while(page.hasNextPage()){
            page = await page.getNextPage();
            yield page;
        }
    }
    async *[(_AbstractPage_client = new WeakMap(), Symbol.asyncIterator)]() {
        for await (const page of this.iterPages()){
            for (const item of page.getPaginatedItems()){
                yield item;
            }
        }
    }
}
exports.AbstractPage = AbstractPage;
/**
 * This subclass of Promise will resolve to an instantiated Page once the request completes.
 *
 * It also implements AsyncIterable to allow auto-paginating iteration on an unawaited list call, eg:
 *
 *    for await (const item of client.items.list()) {
 *      console.log(item)
 *    }
 */ class PagePromise extends APIPromise {
    constructor(client, request, Page){
        super(request, async (props)=>new Page(client, props.response, await defaultParseResponse(props), props.options));
    }
    /**
     * Allow auto-paginating iteration on an unawaited list call, eg:
     *
     *    for await (const item of client.items.list()) {
     *      console.log(item)
     *    }
     */ async *[Symbol.asyncIterator]() {
        const page = await this;
        for await (const item of page){
            yield item;
        }
    }
}
exports.PagePromise = PagePromise;
const createResponseHeaders = (headers)=>{
    return new Proxy(Object.fromEntries(// @ts-ignore
    headers.entries()), {
        get (target, name) {
            const key = name.toString();
            return target[key.toLowerCase()] || target[key];
        }
    });
};
exports.createResponseHeaders = createResponseHeaders;
// This is required so that we can determine if a given object matches the RequestOptions
// type at runtime. While this requires duplication, it is enforced by the TypeScript
// compiler such that any missing / extraneous keys will cause an error.
const requestOptionsKeys = {
    method: true,
    path: true,
    query: true,
    body: true,
    headers: true,
    maxRetries: true,
    stream: true,
    timeout: true,
    httpAgent: true,
    signal: true,
    idempotencyKey: true,
    __binaryResponse: true,
    __streamClass: true
};
const isRequestOptions = (obj)=>{
    return typeof obj === 'object' && obj !== null && !isEmptyObj(obj) && Object.keys(obj).every((k)=>hasOwn(requestOptionsKeys, k));
};
exports.isRequestOptions = isRequestOptions;
const getPlatformProperties = ()=>{
    if (typeof Deno !== 'undefined' && Deno.build != null) {
        return {
            'X-Stainless-Lang': 'js',
            'X-Stainless-Package-Version': version_1.VERSION,
            'X-Stainless-OS': normalizePlatform(Deno.build.os),
            'X-Stainless-Arch': normalizeArch(Deno.build.arch),
            'X-Stainless-Runtime': 'deno',
            'X-Stainless-Runtime-Version': typeof Deno.version === 'string' ? Deno.version : Deno.version?.deno ?? 'unknown'
        };
    }
    if (typeof EdgeRuntime !== 'undefined') {
        return {
            'X-Stainless-Lang': 'js',
            'X-Stainless-Package-Version': version_1.VERSION,
            'X-Stainless-OS': 'Unknown',
            'X-Stainless-Arch': `other:${EdgeRuntime}`,
            'X-Stainless-Runtime': 'edge',
            'X-Stainless-Runtime-Version': process.version
        };
    }
    // Check if Node.js
    if (Object.prototype.toString.call(typeof process !== 'undefined' ? process : 0) === '[object process]') {
        return {
            'X-Stainless-Lang': 'js',
            'X-Stainless-Package-Version': version_1.VERSION,
            'X-Stainless-OS': normalizePlatform(process.platform),
            'X-Stainless-Arch': normalizeArch(process.arch),
            'X-Stainless-Runtime': 'node',
            'X-Stainless-Runtime-Version': process.version
        };
    }
    const browserInfo = getBrowserInfo();
    if (browserInfo) {
        return {
            'X-Stainless-Lang': 'js',
            'X-Stainless-Package-Version': version_1.VERSION,
            'X-Stainless-OS': 'Unknown',
            'X-Stainless-Arch': 'unknown',
            'X-Stainless-Runtime': `browser:${browserInfo.browser}`,
            'X-Stainless-Runtime-Version': browserInfo.version
        };
    }
    // TODO add support for Cloudflare workers, etc.
    return {
        'X-Stainless-Lang': 'js',
        'X-Stainless-Package-Version': version_1.VERSION,
        'X-Stainless-OS': 'Unknown',
        'X-Stainless-Arch': 'unknown',
        'X-Stainless-Runtime': 'unknown',
        'X-Stainless-Runtime-Version': 'unknown'
    };
};
// Note: modified from https://github.com/JS-DevTools/host-environment/blob/b1ab79ecde37db5d6e163c050e54fe7d287d7c92/src/isomorphic.browser.ts
function getBrowserInfo() {
    if (typeof navigator === 'undefined' || !navigator) {
        return null;
    }
    // NOTE: The order matters here!
    const browserPatterns = [
        {
            key: 'edge',
            pattern: /Edge(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/
        },
        {
            key: 'ie',
            pattern: /MSIE(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/
        },
        {
            key: 'ie',
            pattern: /Trident(?:.*rv\:(\d+)\.(\d+)(?:\.(\d+))?)?/
        },
        {
            key: 'chrome',
            pattern: /Chrome(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/
        },
        {
            key: 'firefox',
            pattern: /Firefox(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/
        },
        {
            key: 'safari',
            pattern: /(?:Version\W+(\d+)\.(\d+)(?:\.(\d+))?)?(?:\W+Mobile\S*)?\W+Safari/
        }
    ];
    // Find the FIRST matching browser
    for (const { key, pattern } of browserPatterns){
        const match = pattern.exec(navigator.userAgent);
        if (match) {
            const major = match[1] || 0;
            const minor = match[2] || 0;
            const patch = match[3] || 0;
            return {
                browser: key,
                version: `${major}.${minor}.${patch}`
            };
        }
    }
    return null;
}
const normalizeArch = (arch)=>{
    // Node docs:
    // - https://nodejs.org/api/process.html#processarch
    // Deno docs:
    // - https://doc.deno.land/deno/stable/~/Deno.build
    if (arch === 'x32') return 'x32';
    if (arch === 'x86_64' || arch === 'x64') return 'x64';
    if (arch === 'arm') return 'arm';
    if (arch === 'aarch64' || arch === 'arm64') return 'arm64';
    if (arch) return `other:${arch}`;
    return 'unknown';
};
const normalizePlatform = (platform)=>{
    // Node platforms:
    // - https://nodejs.org/api/process.html#processplatform
    // Deno platforms:
    // - https://doc.deno.land/deno/stable/~/Deno.build
    // - https://github.com/denoland/deno/issues/14799
    platform = platform.toLowerCase();
    // NOTE: this iOS check is untested and may not work
    // Node does not work natively on IOS, there is a fork at
    // https://github.com/nodejs-mobile/nodejs-mobile
    // however it is unknown at the time of writing how to detect if it is running
    if (platform.includes('ios')) return 'iOS';
    if (platform === 'android') return 'Android';
    if (platform === 'darwin') return 'MacOS';
    if (platform === 'win32') return 'Windows';
    if (platform === 'freebsd') return 'FreeBSD';
    if (platform === 'openbsd') return 'OpenBSD';
    if (platform === 'linux') return 'Linux';
    if (platform) return `Other:${platform}`;
    return 'Unknown';
};
let _platformHeaders;
const getPlatformHeaders = ()=>{
    return _platformHeaders ?? (_platformHeaders = getPlatformProperties());
};
const safeJSON = (text)=>{
    try {
        return JSON.parse(text);
    } catch (err) {
        return undefined;
    }
};
exports.safeJSON = safeJSON;
// https://stackoverflow.com/a/19709846
const startsWithSchemeRegexp = new RegExp('^(?:[a-z]+:)?//', 'i');
const isAbsoluteURL = (url)=>{
    return startsWithSchemeRegexp.test(url);
};
const sleep = (ms)=>new Promise((resolve)=>setTimeout(resolve, ms));
exports.sleep = sleep;
const validatePositiveInteger = (name, n)=>{
    if (typeof n !== 'number' || !Number.isInteger(n)) {
        throw new error_1.OpenAIError(`${name} must be an integer`);
    }
    if (n < 0) {
        throw new error_1.OpenAIError(`${name} must be a positive integer`);
    }
    return n;
};
const castToError = (err)=>{
    if (err instanceof Error) return err;
    return new Error(err);
};
exports.castToError = castToError;
const ensurePresent = (value)=>{
    if (value == null) throw new error_1.OpenAIError(`Expected a value to be given but received ${value} instead.`);
    return value;
};
exports.ensurePresent = ensurePresent;
/**
 * Read an environment variable.
 *
 * Trims beginning and trailing whitespace.
 *
 * Will return undefined if the environment variable doesn't exist or cannot be accessed.
 */ const readEnv = (env)=>{
    if (typeof process !== 'undefined') {
        return process.env?.[env]?.trim() ?? undefined;
    }
    if (typeof Deno !== 'undefined') {
        return Deno.env?.get?.(env)?.trim();
    }
    return undefined;
};
exports.readEnv = readEnv;
const coerceInteger = (value)=>{
    if (typeof value === 'number') return Math.round(value);
    if (typeof value === 'string') return parseInt(value, 10);
    throw new error_1.OpenAIError(`Could not coerce ${value} (type: ${typeof value}) into a number`);
};
exports.coerceInteger = coerceInteger;
const coerceFloat = (value)=>{
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseFloat(value);
    throw new error_1.OpenAIError(`Could not coerce ${value} (type: ${typeof value}) into a number`);
};
exports.coerceFloat = coerceFloat;
const coerceBoolean = (value)=>{
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value === 'true';
    return Boolean(value);
};
exports.coerceBoolean = coerceBoolean;
const maybeCoerceInteger = (value)=>{
    if (value === undefined) {
        return undefined;
    }
    return (0, exports.coerceInteger)(value);
};
exports.maybeCoerceInteger = maybeCoerceInteger;
const maybeCoerceFloat = (value)=>{
    if (value === undefined) {
        return undefined;
    }
    return (0, exports.coerceFloat)(value);
};
exports.maybeCoerceFloat = maybeCoerceFloat;
const maybeCoerceBoolean = (value)=>{
    if (value === undefined) {
        return undefined;
    }
    return (0, exports.coerceBoolean)(value);
};
exports.maybeCoerceBoolean = maybeCoerceBoolean;
// https://stackoverflow.com/a/34491287
function isEmptyObj(obj) {
    if (!obj) return true;
    for(const _k in obj)return false;
    return true;
}
exports.isEmptyObj = isEmptyObj;
// https://eslint.org/docs/latest/rules/no-prototype-builtins
function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
}
exports.hasOwn = hasOwn;
/**
 * Copies headers from "newHeaders" onto "targetHeaders",
 * using lower-case for all properties,
 * ignoring any keys with undefined values,
 * and deleting any keys with null values.
 */ function applyHeadersMut(targetHeaders, newHeaders) {
    for(const k in newHeaders){
        if (!hasOwn(newHeaders, k)) continue;
        const lowerKey = k.toLowerCase();
        if (!lowerKey) continue;
        const val = newHeaders[k];
        if (val === null) {
            delete targetHeaders[lowerKey];
        } else if (val !== undefined) {
            targetHeaders[lowerKey] = val;
        }
    }
}
function debug(action, ...args) {
    if (typeof process !== 'undefined' && process?.env?.['DEBUG'] === 'true') {
        console.log(`OpenAI:DEBUG:${action}`, ...args);
    }
}
exports.debug = debug;
/**
 * https://stackoverflow.com/a/2117523
 */ const uuid4 = ()=>{
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c)=>{
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : r & 0x3 | 0x8;
        return v.toString(16);
    });
};
const isRunningInBrowser = ()=>{
    return(// @ts-ignore
    "undefined" !== 'undefined' && // @ts-ignore
    typeof window.document !== 'undefined' && // @ts-ignore
    typeof navigator !== 'undefined');
};
exports.isRunningInBrowser = isRunningInBrowser;
const isHeadersProtocol = (headers)=>{
    return typeof headers?.get === 'function';
};
exports.isHeadersProtocol = isHeadersProtocol;
const getRequiredHeader = (headers, header)=>{
    const lowerCasedHeader = header.toLowerCase();
    if ((0, exports.isHeadersProtocol)(headers)) {
        // to deal with the case where the header looks like Stainless-Event-Id
        const intercapsHeader = header[0]?.toUpperCase() + header.substring(1).replace(/([^\w])(\w)/g, (_m, g1, g2)=>g1 + g2.toUpperCase());
        for (const key of [
            header,
            lowerCasedHeader,
            header.toUpperCase(),
            intercapsHeader
        ]){
            const value = headers.get(key);
            if (value) {
                return value;
            }
        }
    }
    for (const [key, value] of Object.entries(headers)){
        if (key.toLowerCase() === lowerCasedHeader) {
            if (Array.isArray(value)) {
                if (value.length <= 1) return value[0];
                console.warn(`Received ${value.length} entries for the ${header} header, using the first entry.`);
                return value[0];
            }
            return value;
        }
    }
    throw new Error(`Could not find ${header} header`);
};
exports.getRequiredHeader = getRequiredHeader;
/**
 * Encodes a string to Base64 format.
 */ const toBase64 = (str)=>{
    if (!str) return '';
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(str).toString('base64');
    }
    if (typeof btoa !== 'undefined') {
        return btoa(str);
    }
    throw new error_1.OpenAIError('Cannot generate b64 string; Expected `Buffer` or `btoa` to be defined');
};
exports.toBase64 = toBase64;
function isObj(obj) {
    return obj != null && typeof obj === 'object' && !Array.isArray(obj);
}
exports.isObj = isObj; //# sourceMappingURL=core.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/pagination.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.CursorPage = exports.Page = void 0;
const core_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/core.js [app-rsc] (ecmascript)");
/**
 * Note: no pagination actually occurs yet, this is for forwards-compatibility.
 */ class Page extends core_1.AbstractPage {
    constructor(client, response, body, options){
        super(client, response, body, options);
        this.data = body.data || [];
        this.object = body.object;
    }
    getPaginatedItems() {
        return this.data ?? [];
    }
    // @deprecated Please use `nextPageInfo()` instead
    /**
     * This page represents a response that isn't actually paginated at the API level
     * so there will never be any next page params.
     */ nextPageParams() {
        return null;
    }
    nextPageInfo() {
        return null;
    }
}
exports.Page = Page;
class CursorPage extends core_1.AbstractPage {
    constructor(client, response, body, options){
        super(client, response, body, options);
        this.data = body.data || [];
    }
    getPaginatedItems() {
        return this.data ?? [];
    }
    // @deprecated Please use `nextPageInfo()` instead
    nextPageParams() {
        const info = this.nextPageInfo();
        if (!info) return null;
        if ('params' in info) return info.params;
        const params = Object.fromEntries(info.url.searchParams);
        if (!Object.keys(params).length) return null;
        return params;
    }
    nextPageInfo() {
        const data = this.getPaginatedItems();
        if (!data.length) {
            return null;
        }
        const id = data[data.length - 1]?.id;
        if (!id) {
            return null;
        }
        return {
            params: {
                after: id
            }
        };
    }
}
exports.CursorPage = CursorPage; //# sourceMappingURL=pagination.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resource.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.APIResource = void 0;
class APIResource {
    constructor(client){
        this._client = client;
    }
}
exports.APIResource = APIResource; //# sourceMappingURL=resource.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/chat/completions.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Completions = void 0;
const resource_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resource.js [app-rsc] (ecmascript)");
class Completions extends resource_1.APIResource {
    create(body, options) {
        return this._client.post('/chat/completions', {
            body,
            ...options,
            stream: body.stream ?? false
        });
    }
}
exports.Completions = Completions;
(function(Completions) {})(Completions = exports.Completions || (exports.Completions = {})); //# sourceMappingURL=completions.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/chat/chat.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = this && this.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = {
            enumerable: true,
            get: function() {
                return m[k];
            }
        };
    }
    Object.defineProperty(o, k2, desc);
} : function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
});
var __setModuleDefault = this && this.__setModuleDefault || (Object.create ? function(o, v) {
    Object.defineProperty(o, "default", {
        enumerable: true,
        value: v
    });
} : function(o, v) {
    o["default"] = v;
});
var __importStar = this && this.__importStar || function(mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) {
        for(var k in mod)if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    }
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Chat = void 0;
const resource_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resource.js [app-rsc] (ecmascript)");
const CompletionsAPI = __importStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/chat/completions.js [app-rsc] (ecmascript)"));
class Chat extends resource_1.APIResource {
    constructor(){
        super(...arguments);
        this.completions = new CompletionsAPI.Completions(this._client);
    }
}
exports.Chat = Chat;
(function(Chat) {
    Chat.Completions = CompletionsAPI.Completions;
})(Chat = exports.Chat || (exports.Chat = {})); //# sourceMappingURL=chat.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/chat/index.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Chat = exports.Completions = void 0;
var completions_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/chat/completions.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "Completions", {
    enumerable: true,
    get: function() {
        return completions_1.Completions;
    }
});
var chat_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/chat/chat.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "Chat", {
    enumerable: true,
    get: function() {
        return chat_1.Chat;
    }
}); //# sourceMappingURL=index.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/shared.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", {
    value: true
}); //# sourceMappingURL=shared.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/audio/speech.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Speech = void 0;
const resource_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resource.js [app-rsc] (ecmascript)");
class Speech extends resource_1.APIResource {
    /**
     * Generates audio from the input text.
     */ create(body, options) {
        return this._client.post('/audio/speech', {
            body,
            ...options,
            __binaryResponse: true
        });
    }
}
exports.Speech = Speech;
(function(Speech) {})(Speech = exports.Speech || (exports.Speech = {})); //# sourceMappingURL=speech.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/audio/transcriptions.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Transcriptions = void 0;
const resource_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resource.js [app-rsc] (ecmascript)");
const core_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/core.js [app-rsc] (ecmascript)");
class Transcriptions extends resource_1.APIResource {
    /**
     * Transcribes audio into the input language.
     */ create(body, options) {
        return this._client.post('/audio/transcriptions', (0, core_1.multipartFormRequestOptions)({
            body,
            ...options
        }));
    }
}
exports.Transcriptions = Transcriptions;
(function(Transcriptions) {})(Transcriptions = exports.Transcriptions || (exports.Transcriptions = {})); //# sourceMappingURL=transcriptions.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/audio/translations.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Translations = void 0;
const resource_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resource.js [app-rsc] (ecmascript)");
const core_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/core.js [app-rsc] (ecmascript)");
class Translations extends resource_1.APIResource {
    /**
     * Translates audio into English.
     */ create(body, options) {
        return this._client.post('/audio/translations', (0, core_1.multipartFormRequestOptions)({
            body,
            ...options
        }));
    }
}
exports.Translations = Translations;
(function(Translations) {})(Translations = exports.Translations || (exports.Translations = {})); //# sourceMappingURL=translations.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/audio/audio.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = this && this.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = {
            enumerable: true,
            get: function() {
                return m[k];
            }
        };
    }
    Object.defineProperty(o, k2, desc);
} : function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
});
var __setModuleDefault = this && this.__setModuleDefault || (Object.create ? function(o, v) {
    Object.defineProperty(o, "default", {
        enumerable: true,
        value: v
    });
} : function(o, v) {
    o["default"] = v;
});
var __importStar = this && this.__importStar || function(mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) {
        for(var k in mod)if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    }
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Audio = void 0;
const resource_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resource.js [app-rsc] (ecmascript)");
const SpeechAPI = __importStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/audio/speech.js [app-rsc] (ecmascript)"));
const TranscriptionsAPI = __importStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/audio/transcriptions.js [app-rsc] (ecmascript)"));
const TranslationsAPI = __importStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/audio/translations.js [app-rsc] (ecmascript)"));
class Audio extends resource_1.APIResource {
    constructor(){
        super(...arguments);
        this.transcriptions = new TranscriptionsAPI.Transcriptions(this._client);
        this.translations = new TranslationsAPI.Translations(this._client);
        this.speech = new SpeechAPI.Speech(this._client);
    }
}
exports.Audio = Audio;
(function(Audio) {
    Audio.Transcriptions = TranscriptionsAPI.Transcriptions;
    Audio.Translations = TranslationsAPI.Translations;
    Audio.Speech = SpeechAPI.Speech;
})(Audio = exports.Audio || (exports.Audio = {})); //# sourceMappingURL=audio.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/batches.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Batches = void 0;
const resource_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resource.js [app-rsc] (ecmascript)");
class Batches extends resource_1.APIResource {
    /**
     * Creates and executes a batch from an uploaded file of requests
     */ create(body, options) {
        return this._client.post('/batches', {
            body,
            ...options
        });
    }
    /**
     * Retrieves a batch.
     */ retrieve(batchId, options) {
        return this._client.get(`/batches/${batchId}`, options);
    }
    /**
     * Cancels an in-progress batch.
     */ cancel(batchId, options) {
        return this._client.post(`/batches/${batchId}/cancel`, options);
    }
}
exports.Batches = Batches;
(function(Batches) {})(Batches = exports.Batches || (exports.Batches = {})); //# sourceMappingURL=batches.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/beta/assistants/files.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = this && this.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = {
            enumerable: true,
            get: function() {
                return m[k];
            }
        };
    }
    Object.defineProperty(o, k2, desc);
} : function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
});
var __setModuleDefault = this && this.__setModuleDefault || (Object.create ? function(o, v) {
    Object.defineProperty(o, "default", {
        enumerable: true,
        value: v
    });
} : function(o, v) {
    o["default"] = v;
});
var __importStar = this && this.__importStar || function(mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) {
        for(var k in mod)if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    }
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.AssistantFilesPage = exports.Files = void 0;
const resource_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resource.js [app-rsc] (ecmascript)");
const core_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/core.js [app-rsc] (ecmascript)");
const FilesAPI = __importStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/beta/assistants/files.js [app-rsc] (ecmascript)"));
const pagination_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/pagination.js [app-rsc] (ecmascript)");
class Files extends resource_1.APIResource {
    /**
     * Create an assistant file by attaching a
     * [File](https://platform.openai.com/docs/api-reference/files) to an
     * [assistant](https://platform.openai.com/docs/api-reference/assistants).
     */ create(assistantId, body, options) {
        return this._client.post(`/assistants/${assistantId}/files`, {
            body,
            ...options,
            headers: {
                'OpenAI-Beta': 'assistants=v1',
                ...options?.headers
            }
        });
    }
    /**
     * Retrieves an AssistantFile.
     */ retrieve(assistantId, fileId, options) {
        return this._client.get(`/assistants/${assistantId}/files/${fileId}`, {
            ...options,
            headers: {
                'OpenAI-Beta': 'assistants=v1',
                ...options?.headers
            }
        });
    }
    list(assistantId, query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.list(assistantId, {}, query);
        }
        return this._client.getAPIList(`/assistants/${assistantId}/files`, AssistantFilesPage, {
            query,
            ...options,
            headers: {
                'OpenAI-Beta': 'assistants=v1',
                ...options?.headers
            }
        });
    }
    /**
     * Delete an assistant file.
     */ del(assistantId, fileId, options) {
        return this._client.delete(`/assistants/${assistantId}/files/${fileId}`, {
            ...options,
            headers: {
                'OpenAI-Beta': 'assistants=v1',
                ...options?.headers
            }
        });
    }
}
exports.Files = Files;
class AssistantFilesPage extends pagination_1.CursorPage {
}
exports.AssistantFilesPage = AssistantFilesPage;
(function(Files) {
    Files.AssistantFilesPage = FilesAPI.AssistantFilesPage;
})(Files = exports.Files || (exports.Files = {})); //# sourceMappingURL=files.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/beta/assistants/assistants.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = this && this.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = {
            enumerable: true,
            get: function() {
                return m[k];
            }
        };
    }
    Object.defineProperty(o, k2, desc);
} : function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
});
var __setModuleDefault = this && this.__setModuleDefault || (Object.create ? function(o, v) {
    Object.defineProperty(o, "default", {
        enumerable: true,
        value: v
    });
} : function(o, v) {
    o["default"] = v;
});
var __importStar = this && this.__importStar || function(mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) {
        for(var k in mod)if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    }
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.AssistantsPage = exports.Assistants = void 0;
const resource_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resource.js [app-rsc] (ecmascript)");
const core_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/core.js [app-rsc] (ecmascript)");
const AssistantsAPI = __importStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/beta/assistants/assistants.js [app-rsc] (ecmascript)"));
const FilesAPI = __importStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/beta/assistants/files.js [app-rsc] (ecmascript)"));
const pagination_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/pagination.js [app-rsc] (ecmascript)");
class Assistants extends resource_1.APIResource {
    constructor(){
        super(...arguments);
        this.files = new FilesAPI.Files(this._client);
    }
    /**
     * Create an assistant with a model and instructions.
     */ create(body, options) {
        return this._client.post('/assistants', {
            body,
            ...options,
            headers: {
                'OpenAI-Beta': 'assistants=v1',
                ...options?.headers
            }
        });
    }
    /**
     * Retrieves an assistant.
     */ retrieve(assistantId, options) {
        return this._client.get(`/assistants/${assistantId}`, {
            ...options,
            headers: {
                'OpenAI-Beta': 'assistants=v1',
                ...options?.headers
            }
        });
    }
    /**
     * Modifies an assistant.
     */ update(assistantId, body, options) {
        return this._client.post(`/assistants/${assistantId}`, {
            body,
            ...options,
            headers: {
                'OpenAI-Beta': 'assistants=v1',
                ...options?.headers
            }
        });
    }
    list(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.list({}, query);
        }
        return this._client.getAPIList('/assistants', AssistantsPage, {
            query,
            ...options,
            headers: {
                'OpenAI-Beta': 'assistants=v1',
                ...options?.headers
            }
        });
    }
    /**
     * Delete an assistant.
     */ del(assistantId, options) {
        return this._client.delete(`/assistants/${assistantId}`, {
            ...options,
            headers: {
                'OpenAI-Beta': 'assistants=v1',
                ...options?.headers
            }
        });
    }
}
exports.Assistants = Assistants;
class AssistantsPage extends pagination_1.CursorPage {
}
exports.AssistantsPage = AssistantsPage;
(function(Assistants) {
    Assistants.AssistantsPage = AssistantsAPI.AssistantsPage;
    Assistants.Files = FilesAPI.Files;
    Assistants.AssistantFilesPage = FilesAPI.AssistantFilesPage;
})(Assistants = exports.Assistants || (exports.Assistants = {})); //# sourceMappingURL=assistants.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/lib/RunnableFunction.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.ParsingToolFunction = exports.ParsingFunction = exports.isRunnableFunctionWithParse = void 0;
function isRunnableFunctionWithParse(fn) {
    return typeof fn.parse === 'function';
}
exports.isRunnableFunctionWithParse = isRunnableFunctionWithParse;
/**
 * This is helper class for passing a `function` and `parse` where the `function`
 * argument type matches the `parse` return type.
 *
 * @deprecated - please use ParsingToolFunction instead.
 */ class ParsingFunction {
    constructor(input){
        this.function = input.function;
        this.parse = input.parse;
        this.parameters = input.parameters;
        this.description = input.description;
        this.name = input.name;
    }
}
exports.ParsingFunction = ParsingFunction;
/**
 * This is helper class for passing a `function` and `parse` where the `function`
 * argument type matches the `parse` return type.
 */ class ParsingToolFunction {
    constructor(input){
        this.type = 'function';
        this.function = input;
    }
}
exports.ParsingToolFunction = ParsingToolFunction; //# sourceMappingURL=RunnableFunction.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/lib/chatCompletionUtils.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.isPresent = exports.isToolMessage = exports.isFunctionMessage = exports.isAssistantMessage = void 0;
const isAssistantMessage = (message)=>{
    return message?.role === 'assistant';
};
exports.isAssistantMessage = isAssistantMessage;
const isFunctionMessage = (message)=>{
    return message?.role === 'function';
};
exports.isFunctionMessage = isFunctionMessage;
const isToolMessage = (message)=>{
    return message?.role === 'tool';
};
exports.isToolMessage = isToolMessage;
function isPresent(obj) {
    return obj != null;
}
exports.isPresent = isPresent; //# sourceMappingURL=chatCompletionUtils.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/lib/AbstractChatCompletionRunner.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
var __classPrivateFieldSet = this && this.__classPrivateFieldSet || function(receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
};
var __classPrivateFieldGet = this && this.__classPrivateFieldGet || function(receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _AbstractChatCompletionRunner_instances, _AbstractChatCompletionRunner_connectedPromise, _AbstractChatCompletionRunner_resolveConnectedPromise, _AbstractChatCompletionRunner_rejectConnectedPromise, _AbstractChatCompletionRunner_endPromise, _AbstractChatCompletionRunner_resolveEndPromise, _AbstractChatCompletionRunner_rejectEndPromise, _AbstractChatCompletionRunner_listeners, _AbstractChatCompletionRunner_ended, _AbstractChatCompletionRunner_errored, _AbstractChatCompletionRunner_aborted, _AbstractChatCompletionRunner_catchingPromiseCreated, _AbstractChatCompletionRunner_getFinalContent, _AbstractChatCompletionRunner_getFinalMessage, _AbstractChatCompletionRunner_getFinalFunctionCall, _AbstractChatCompletionRunner_getFinalFunctionCallResult, _AbstractChatCompletionRunner_calculateTotalUsage, _AbstractChatCompletionRunner_handleError, _AbstractChatCompletionRunner_validateParams, _AbstractChatCompletionRunner_stringifyFunctionCallResult;
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.AbstractChatCompletionRunner = void 0;
const error_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/error.js [app-rsc] (ecmascript)");
const RunnableFunction_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/lib/RunnableFunction.js [app-rsc] (ecmascript)");
const chatCompletionUtils_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/lib/chatCompletionUtils.js [app-rsc] (ecmascript)");
const DEFAULT_MAX_CHAT_COMPLETIONS = 10;
class AbstractChatCompletionRunner {
    constructor(){
        _AbstractChatCompletionRunner_instances.add(this);
        this.controller = new AbortController();
        _AbstractChatCompletionRunner_connectedPromise.set(this, void 0);
        _AbstractChatCompletionRunner_resolveConnectedPromise.set(this, ()=>{});
        _AbstractChatCompletionRunner_rejectConnectedPromise.set(this, ()=>{});
        _AbstractChatCompletionRunner_endPromise.set(this, void 0);
        _AbstractChatCompletionRunner_resolveEndPromise.set(this, ()=>{});
        _AbstractChatCompletionRunner_rejectEndPromise.set(this, ()=>{});
        _AbstractChatCompletionRunner_listeners.set(this, {});
        this._chatCompletions = [];
        this.messages = [];
        _AbstractChatCompletionRunner_ended.set(this, false);
        _AbstractChatCompletionRunner_errored.set(this, false);
        _AbstractChatCompletionRunner_aborted.set(this, false);
        _AbstractChatCompletionRunner_catchingPromiseCreated.set(this, false);
        _AbstractChatCompletionRunner_handleError.set(this, (error)=>{
            __classPrivateFieldSet(this, _AbstractChatCompletionRunner_errored, true, "f");
            if (error instanceof Error && error.name === 'AbortError') {
                error = new error_1.APIUserAbortError();
            }
            if (error instanceof error_1.APIUserAbortError) {
                __classPrivateFieldSet(this, _AbstractChatCompletionRunner_aborted, true, "f");
                return this._emit('abort', error);
            }
            if (error instanceof error_1.OpenAIError) {
                return this._emit('error', error);
            }
            if (error instanceof Error) {
                const openAIError = new error_1.OpenAIError(error.message);
                // @ts-ignore
                openAIError.cause = error;
                return this._emit('error', openAIError);
            }
            return this._emit('error', new error_1.OpenAIError(String(error)));
        });
        __classPrivateFieldSet(this, _AbstractChatCompletionRunner_connectedPromise, new Promise((resolve, reject)=>{
            __classPrivateFieldSet(this, _AbstractChatCompletionRunner_resolveConnectedPromise, resolve, "f");
            __classPrivateFieldSet(this, _AbstractChatCompletionRunner_rejectConnectedPromise, reject, "f");
        }), "f");
        __classPrivateFieldSet(this, _AbstractChatCompletionRunner_endPromise, new Promise((resolve, reject)=>{
            __classPrivateFieldSet(this, _AbstractChatCompletionRunner_resolveEndPromise, resolve, "f");
            __classPrivateFieldSet(this, _AbstractChatCompletionRunner_rejectEndPromise, reject, "f");
        }), "f");
        // Don't let these promises cause unhandled rejection errors.
        // we will manually cause an unhandled rejection error later
        // if the user hasn't registered any error listener or called
        // any promise-returning method.
        __classPrivateFieldGet(this, _AbstractChatCompletionRunner_connectedPromise, "f").catch(()=>{});
        __classPrivateFieldGet(this, _AbstractChatCompletionRunner_endPromise, "f").catch(()=>{});
    }
    _run(executor) {
        // Unfortunately if we call `executor()` immediately we get runtime errors about
        // references to `this` before the `super()` constructor call returns.
        setTimeout(()=>{
            executor().then(()=>{
                this._emitFinal();
                this._emit('end');
            }, __classPrivateFieldGet(this, _AbstractChatCompletionRunner_handleError, "f"));
        }, 0);
    }
    _addChatCompletion(chatCompletion) {
        this._chatCompletions.push(chatCompletion);
        this._emit('chatCompletion', chatCompletion);
        const message = chatCompletion.choices[0]?.message;
        if (message) this._addMessage(message);
        return chatCompletion;
    }
    _addMessage(message, emit = true) {
        if (!('content' in message)) message.content = null;
        this.messages.push(message);
        if (emit) {
            this._emit('message', message);
            if (((0, chatCompletionUtils_1.isFunctionMessage)(message) || (0, chatCompletionUtils_1.isToolMessage)(message)) && message.content) {
                // Note, this assumes that {role: 'tool', content: …} is always the result of a call of tool of type=function.
                this._emit('functionCallResult', message.content);
            } else if ((0, chatCompletionUtils_1.isAssistantMessage)(message) && message.function_call) {
                this._emit('functionCall', message.function_call);
            } else if ((0, chatCompletionUtils_1.isAssistantMessage)(message) && message.tool_calls) {
                for (const tool_call of message.tool_calls){
                    if (tool_call.type === 'function') {
                        this._emit('functionCall', tool_call.function);
                    }
                }
            }
        }
    }
    _connected() {
        if (this.ended) return;
        __classPrivateFieldGet(this, _AbstractChatCompletionRunner_resolveConnectedPromise, "f").call(this);
        this._emit('connect');
    }
    get ended() {
        return __classPrivateFieldGet(this, _AbstractChatCompletionRunner_ended, "f");
    }
    get errored() {
        return __classPrivateFieldGet(this, _AbstractChatCompletionRunner_errored, "f");
    }
    get aborted() {
        return __classPrivateFieldGet(this, _AbstractChatCompletionRunner_aborted, "f");
    }
    abort() {
        this.controller.abort();
    }
    /**
     * Adds the listener function to the end of the listeners array for the event.
     * No checks are made to see if the listener has already been added. Multiple calls passing
     * the same combination of event and listener will result in the listener being added, and
     * called, multiple times.
     * @returns this ChatCompletionStream, so that calls can be chained
     */ on(event, listener) {
        const listeners = __classPrivateFieldGet(this, _AbstractChatCompletionRunner_listeners, "f")[event] || (__classPrivateFieldGet(this, _AbstractChatCompletionRunner_listeners, "f")[event] = []);
        listeners.push({
            listener
        });
        return this;
    }
    /**
     * Removes the specified listener from the listener array for the event.
     * off() will remove, at most, one instance of a listener from the listener array. If any single
     * listener has been added multiple times to the listener array for the specified event, then
     * off() must be called multiple times to remove each instance.
     * @returns this ChatCompletionStream, so that calls can be chained
     */ off(event, listener) {
        const listeners = __classPrivateFieldGet(this, _AbstractChatCompletionRunner_listeners, "f")[event];
        if (!listeners) return this;
        const index = listeners.findIndex((l)=>l.listener === listener);
        if (index >= 0) listeners.splice(index, 1);
        return this;
    }
    /**
     * Adds a one-time listener function for the event. The next time the event is triggered,
     * this listener is removed and then invoked.
     * @returns this ChatCompletionStream, so that calls can be chained
     */ once(event, listener) {
        const listeners = __classPrivateFieldGet(this, _AbstractChatCompletionRunner_listeners, "f")[event] || (__classPrivateFieldGet(this, _AbstractChatCompletionRunner_listeners, "f")[event] = []);
        listeners.push({
            listener,
            once: true
        });
        return this;
    }
    /**
     * This is similar to `.once()`, but returns a Promise that resolves the next time
     * the event is triggered, instead of calling a listener callback.
     * @returns a Promise that resolves the next time given event is triggered,
     * or rejects if an error is emitted.  (If you request the 'error' event,
     * returns a promise that resolves with the error).
     *
     * Example:
     *
     *   const message = await stream.emitted('message') // rejects if the stream errors
     */ emitted(event) {
        return new Promise((resolve, reject)=>{
            __classPrivateFieldSet(this, _AbstractChatCompletionRunner_catchingPromiseCreated, true, "f");
            if (event !== 'error') this.once('error', reject);
            this.once(event, resolve);
        });
    }
    async done() {
        __classPrivateFieldSet(this, _AbstractChatCompletionRunner_catchingPromiseCreated, true, "f");
        await __classPrivateFieldGet(this, _AbstractChatCompletionRunner_endPromise, "f");
    }
    /**
     * @returns a promise that resolves with the final ChatCompletion, or rejects
     * if an error occurred or the stream ended prematurely without producing a ChatCompletion.
     */ async finalChatCompletion() {
        await this.done();
        const completion = this._chatCompletions[this._chatCompletions.length - 1];
        if (!completion) throw new error_1.OpenAIError('stream ended without producing a ChatCompletion');
        return completion;
    }
    /**
     * @returns a promise that resolves with the content of the final ChatCompletionMessage, or rejects
     * if an error occurred or the stream ended prematurely without producing a ChatCompletionMessage.
     */ async finalContent() {
        await this.done();
        return __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalContent).call(this);
    }
    /**
     * @returns a promise that resolves with the the final assistant ChatCompletionMessage response,
     * or rejects if an error occurred or the stream ended prematurely without producing a ChatCompletionMessage.
     */ async finalMessage() {
        await this.done();
        return __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalMessage).call(this);
    }
    /**
     * @returns a promise that resolves with the content of the final FunctionCall, or rejects
     * if an error occurred or the stream ended prematurely without producing a ChatCompletionMessage.
     */ async finalFunctionCall() {
        await this.done();
        return __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalFunctionCall).call(this);
    }
    async finalFunctionCallResult() {
        await this.done();
        return __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalFunctionCallResult).call(this);
    }
    async totalUsage() {
        await this.done();
        return __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_calculateTotalUsage).call(this);
    }
    allChatCompletions() {
        return [
            ...this._chatCompletions
        ];
    }
    _emit(event, ...args) {
        // make sure we don't emit any events after end
        if (__classPrivateFieldGet(this, _AbstractChatCompletionRunner_ended, "f")) {
            return;
        }
        if (event === 'end') {
            __classPrivateFieldSet(this, _AbstractChatCompletionRunner_ended, true, "f");
            __classPrivateFieldGet(this, _AbstractChatCompletionRunner_resolveEndPromise, "f").call(this);
        }
        const listeners = __classPrivateFieldGet(this, _AbstractChatCompletionRunner_listeners, "f")[event];
        if (listeners) {
            __classPrivateFieldGet(this, _AbstractChatCompletionRunner_listeners, "f")[event] = listeners.filter((l)=>!l.once);
            listeners.forEach(({ listener })=>listener(...args));
        }
        if (event === 'abort') {
            const error = args[0];
            if (!__classPrivateFieldGet(this, _AbstractChatCompletionRunner_catchingPromiseCreated, "f") && !listeners?.length) {
                Promise.reject(error);
            }
            __classPrivateFieldGet(this, _AbstractChatCompletionRunner_rejectConnectedPromise, "f").call(this, error);
            __classPrivateFieldGet(this, _AbstractChatCompletionRunner_rejectEndPromise, "f").call(this, error);
            this._emit('end');
            return;
        }
        if (event === 'error') {
            // NOTE: _emit('error', error) should only be called from #handleError().
            const error = args[0];
            if (!__classPrivateFieldGet(this, _AbstractChatCompletionRunner_catchingPromiseCreated, "f") && !listeners?.length) {
                // Trigger an unhandled rejection if the user hasn't registered any error handlers.
                // If you are seeing stack traces here, make sure to handle errors via either:
                // - runner.on('error', () => ...)
                // - await runner.done()
                // - await runner.finalChatCompletion()
                // - etc.
                Promise.reject(error);
            }
            __classPrivateFieldGet(this, _AbstractChatCompletionRunner_rejectConnectedPromise, "f").call(this, error);
            __classPrivateFieldGet(this, _AbstractChatCompletionRunner_rejectEndPromise, "f").call(this, error);
            this._emit('end');
        }
    }
    _emitFinal() {
        const completion = this._chatCompletions[this._chatCompletions.length - 1];
        if (completion) this._emit('finalChatCompletion', completion);
        const finalMessage = __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalMessage).call(this);
        if (finalMessage) this._emit('finalMessage', finalMessage);
        const finalContent = __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalContent).call(this);
        if (finalContent) this._emit('finalContent', finalContent);
        const finalFunctionCall = __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalFunctionCall).call(this);
        if (finalFunctionCall) this._emit('finalFunctionCall', finalFunctionCall);
        const finalFunctionCallResult = __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalFunctionCallResult).call(this);
        if (finalFunctionCallResult != null) this._emit('finalFunctionCallResult', finalFunctionCallResult);
        if (this._chatCompletions.some((c)=>c.usage)) {
            this._emit('totalUsage', __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_calculateTotalUsage).call(this));
        }
    }
    async _createChatCompletion(completions, params, options) {
        const signal = options?.signal;
        if (signal) {
            if (signal.aborted) this.controller.abort();
            signal.addEventListener('abort', ()=>this.controller.abort());
        }
        __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_validateParams).call(this, params);
        const chatCompletion = await completions.create({
            ...params,
            stream: false
        }, {
            ...options,
            signal: this.controller.signal
        });
        this._connected();
        return this._addChatCompletion(chatCompletion);
    }
    async _runChatCompletion(completions, params, options) {
        for (const message of params.messages){
            this._addMessage(message, false);
        }
        return await this._createChatCompletion(completions, params, options);
    }
    async _runFunctions(completions, params, options) {
        const role = 'function';
        const { function_call = 'auto', stream, ...restParams } = params;
        const singleFunctionToCall = typeof function_call !== 'string' && function_call?.name;
        const { maxChatCompletions = DEFAULT_MAX_CHAT_COMPLETIONS } = options || {};
        const functionsByName = {};
        for (const f of params.functions){
            functionsByName[f.name || f.function.name] = f;
        }
        const functions = params.functions.map((f)=>({
                name: f.name || f.function.name,
                parameters: f.parameters,
                description: f.description
            }));
        for (const message of params.messages){
            this._addMessage(message, false);
        }
        for(let i = 0; i < maxChatCompletions; ++i){
            const chatCompletion = await this._createChatCompletion(completions, {
                ...restParams,
                function_call,
                functions,
                messages: [
                    ...this.messages
                ]
            }, options);
            const message = chatCompletion.choices[0]?.message;
            if (!message) {
                throw new error_1.OpenAIError(`missing message in ChatCompletion response`);
            }
            if (!message.function_call) return;
            const { name, arguments: args } = message.function_call;
            const fn = functionsByName[name];
            if (!fn) {
                const content = `Invalid function_call: ${JSON.stringify(name)}. Available options are: ${functions.map((f)=>JSON.stringify(f.name)).join(', ')}. Please try again`;
                this._addMessage({
                    role,
                    name,
                    content
                });
                continue;
            } else if (singleFunctionToCall && singleFunctionToCall !== name) {
                const content = `Invalid function_call: ${JSON.stringify(name)}. ${JSON.stringify(singleFunctionToCall)} requested. Please try again`;
                this._addMessage({
                    role,
                    name,
                    content
                });
                continue;
            }
            let parsed;
            try {
                parsed = (0, RunnableFunction_1.isRunnableFunctionWithParse)(fn) ? await fn.parse(args) : args;
            } catch (error) {
                this._addMessage({
                    role,
                    name,
                    content: error instanceof Error ? error.message : String(error)
                });
                continue;
            }
            // @ts-expect-error it can't rule out `never` type.
            const rawContent = await fn.function(parsed, this);
            const content = __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_stringifyFunctionCallResult).call(this, rawContent);
            this._addMessage({
                role,
                name,
                content
            });
            if (singleFunctionToCall) return;
        }
    }
    async _runTools(completions, params, options) {
        const role = 'tool';
        const { tool_choice = 'auto', stream, ...restParams } = params;
        const singleFunctionToCall = typeof tool_choice !== 'string' && tool_choice?.function?.name;
        const { maxChatCompletions = DEFAULT_MAX_CHAT_COMPLETIONS } = options || {};
        const functionsByName = {};
        for (const f of params.tools){
            if (f.type === 'function') {
                functionsByName[f.function.name || f.function.function.name] = f.function;
            }
        }
        const tools = 'tools' in params ? params.tools.map((t)=>t.type === 'function' ? {
                type: 'function',
                function: {
                    name: t.function.name || t.function.function.name,
                    parameters: t.function.parameters,
                    description: t.function.description
                }
            } : t) : undefined;
        for (const message of params.messages){
            this._addMessage(message, false);
        }
        for(let i = 0; i < maxChatCompletions; ++i){
            const chatCompletion = await this._createChatCompletion(completions, {
                ...restParams,
                tool_choice,
                tools,
                messages: [
                    ...this.messages
                ]
            }, options);
            const message = chatCompletion.choices[0]?.message;
            if (!message) {
                throw new error_1.OpenAIError(`missing message in ChatCompletion response`);
            }
            if (!message.tool_calls) {
                return;
            }
            for (const tool_call of message.tool_calls){
                if (tool_call.type !== 'function') continue;
                const tool_call_id = tool_call.id;
                const { name, arguments: args } = tool_call.function;
                const fn = functionsByName[name];
                if (!fn) {
                    const content = `Invalid tool_call: ${JSON.stringify(name)}. Available options are: ${tools.map((f)=>JSON.stringify(f.function.name)).join(', ')}. Please try again`;
                    this._addMessage({
                        role,
                        tool_call_id,
                        content
                    });
                    continue;
                } else if (singleFunctionToCall && singleFunctionToCall !== name) {
                    const content = `Invalid tool_call: ${JSON.stringify(name)}. ${JSON.stringify(singleFunctionToCall)} requested. Please try again`;
                    this._addMessage({
                        role,
                        tool_call_id,
                        content
                    });
                    continue;
                }
                let parsed;
                try {
                    parsed = (0, RunnableFunction_1.isRunnableFunctionWithParse)(fn) ? await fn.parse(args) : args;
                } catch (error) {
                    const content = error instanceof Error ? error.message : String(error);
                    this._addMessage({
                        role,
                        tool_call_id,
                        content
                    });
                    continue;
                }
                // @ts-expect-error it can't rule out `never` type.
                const rawContent = await fn.function(parsed, this);
                const content = __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_stringifyFunctionCallResult).call(this, rawContent);
                this._addMessage({
                    role,
                    tool_call_id,
                    content
                });
                if (singleFunctionToCall) {
                    return;
                }
            }
        }
        return;
    }
}
exports.AbstractChatCompletionRunner = AbstractChatCompletionRunner;
_AbstractChatCompletionRunner_connectedPromise = new WeakMap(), _AbstractChatCompletionRunner_resolveConnectedPromise = new WeakMap(), _AbstractChatCompletionRunner_rejectConnectedPromise = new WeakMap(), _AbstractChatCompletionRunner_endPromise = new WeakMap(), _AbstractChatCompletionRunner_resolveEndPromise = new WeakMap(), _AbstractChatCompletionRunner_rejectEndPromise = new WeakMap(), _AbstractChatCompletionRunner_listeners = new WeakMap(), _AbstractChatCompletionRunner_ended = new WeakMap(), _AbstractChatCompletionRunner_errored = new WeakMap(), _AbstractChatCompletionRunner_aborted = new WeakMap(), _AbstractChatCompletionRunner_catchingPromiseCreated = new WeakMap(), _AbstractChatCompletionRunner_handleError = new WeakMap(), _AbstractChatCompletionRunner_instances = new WeakSet(), _AbstractChatCompletionRunner_getFinalContent = function _AbstractChatCompletionRunner_getFinalContent() {
    return __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalMessage).call(this).content ?? null;
}, _AbstractChatCompletionRunner_getFinalMessage = function _AbstractChatCompletionRunner_getFinalMessage() {
    let i = this.messages.length;
    while(i-- > 0){
        const message = this.messages[i];
        if ((0, chatCompletionUtils_1.isAssistantMessage)(message)) {
            return {
                ...message,
                content: message.content ?? null
            };
        }
    }
    throw new error_1.OpenAIError('stream ended without producing a ChatCompletionMessage with role=assistant');
}, _AbstractChatCompletionRunner_getFinalFunctionCall = function _AbstractChatCompletionRunner_getFinalFunctionCall() {
    for(let i = this.messages.length - 1; i >= 0; i--){
        const message = this.messages[i];
        if ((0, chatCompletionUtils_1.isAssistantMessage)(message) && message?.function_call) {
            return message.function_call;
        }
        if ((0, chatCompletionUtils_1.isAssistantMessage)(message) && message?.tool_calls?.length) {
            return message.tool_calls.at(-1)?.function;
        }
    }
    return;
}, _AbstractChatCompletionRunner_getFinalFunctionCallResult = function _AbstractChatCompletionRunner_getFinalFunctionCallResult() {
    for(let i = this.messages.length - 1; i >= 0; i--){
        const message = this.messages[i];
        if ((0, chatCompletionUtils_1.isFunctionMessage)(message) && message.content != null) {
            return message.content;
        }
        if ((0, chatCompletionUtils_1.isToolMessage)(message) && message.content != null && this.messages.some((x)=>x.role === 'assistant' && x.tool_calls?.some((y)=>y.type === 'function' && y.id === message.tool_call_id))) {
            return message.content;
        }
    }
    return;
}, _AbstractChatCompletionRunner_calculateTotalUsage = function _AbstractChatCompletionRunner_calculateTotalUsage() {
    const total = {
        completion_tokens: 0,
        prompt_tokens: 0,
        total_tokens: 0
    };
    for (const { usage } of this._chatCompletions){
        if (usage) {
            total.completion_tokens += usage.completion_tokens;
            total.prompt_tokens += usage.prompt_tokens;
            total.total_tokens += usage.total_tokens;
        }
    }
    return total;
}, _AbstractChatCompletionRunner_validateParams = function _AbstractChatCompletionRunner_validateParams(params) {
    if (params.n != null && params.n > 1) {
        throw new error_1.OpenAIError('ChatCompletion convenience helpers only support n=1 at this time. To use n>1, please use chat.completions.create() directly.');
    }
}, _AbstractChatCompletionRunner_stringifyFunctionCallResult = function _AbstractChatCompletionRunner_stringifyFunctionCallResult(rawContent) {
    return typeof rawContent === 'string' ? rawContent : rawContent === undefined ? 'undefined' : JSON.stringify(rawContent);
}; //# sourceMappingURL=AbstractChatCompletionRunner.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/lib/ChatCompletionRunner.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.ChatCompletionRunner = void 0;
const AbstractChatCompletionRunner_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/lib/AbstractChatCompletionRunner.js [app-rsc] (ecmascript)");
const chatCompletionUtils_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/lib/chatCompletionUtils.js [app-rsc] (ecmascript)");
class ChatCompletionRunner extends AbstractChatCompletionRunner_1.AbstractChatCompletionRunner {
    /** @deprecated - please use `runTools` instead. */ static runFunctions(completions, params, options) {
        const runner = new ChatCompletionRunner();
        const opts = {
            ...options,
            headers: {
                ...options?.headers,
                'X-Stainless-Helper-Method': 'runFunctions'
            }
        };
        runner._run(()=>runner._runFunctions(completions, params, opts));
        return runner;
    }
    static runTools(completions, params, options) {
        const runner = new ChatCompletionRunner();
        const opts = {
            ...options,
            headers: {
                ...options?.headers,
                'X-Stainless-Helper-Method': 'runTools'
            }
        };
        runner._run(()=>runner._runTools(completions, params, opts));
        return runner;
    }
    _addMessage(message) {
        super._addMessage(message);
        if ((0, chatCompletionUtils_1.isAssistantMessage)(message) && message.content) {
            this._emit('content', message.content);
        }
    }
}
exports.ChatCompletionRunner = ChatCompletionRunner; //# sourceMappingURL=ChatCompletionRunner.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/lib/ChatCompletionStream.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
var __classPrivateFieldGet = this && this.__classPrivateFieldGet || function(receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __classPrivateFieldSet = this && this.__classPrivateFieldSet || function(receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
};
var _ChatCompletionStream_instances, _ChatCompletionStream_currentChatCompletionSnapshot, _ChatCompletionStream_beginRequest, _ChatCompletionStream_addChunk, _ChatCompletionStream_endRequest, _ChatCompletionStream_accumulateChatCompletion;
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.ChatCompletionStream = void 0;
const error_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/error.js [app-rsc] (ecmascript)");
const AbstractChatCompletionRunner_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/lib/AbstractChatCompletionRunner.js [app-rsc] (ecmascript)");
const streaming_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/streaming.js [app-rsc] (ecmascript)");
class ChatCompletionStream extends AbstractChatCompletionRunner_1.AbstractChatCompletionRunner {
    constructor(){
        super(...arguments);
        _ChatCompletionStream_instances.add(this);
        _ChatCompletionStream_currentChatCompletionSnapshot.set(this, void 0);
    }
    get currentChatCompletionSnapshot() {
        return __classPrivateFieldGet(this, _ChatCompletionStream_currentChatCompletionSnapshot, "f");
    }
    /**
     * Intended for use on the frontend, consuming a stream produced with
     * `.toReadableStream()` on the backend.
     *
     * Note that messages sent to the model do not appear in `.on('message')`
     * in this context.
     */ static fromReadableStream(stream) {
        const runner = new ChatCompletionStream();
        runner._run(()=>runner._fromReadableStream(stream));
        return runner;
    }
    static createChatCompletion(completions, params, options) {
        const runner = new ChatCompletionStream();
        runner._run(()=>runner._runChatCompletion(completions, {
                ...params,
                stream: true
            }, {
                ...options,
                headers: {
                    ...options?.headers,
                    'X-Stainless-Helper-Method': 'stream'
                }
            }));
        return runner;
    }
    async _createChatCompletion(completions, params, options) {
        const signal = options?.signal;
        if (signal) {
            if (signal.aborted) this.controller.abort();
            signal.addEventListener('abort', ()=>this.controller.abort());
        }
        __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_beginRequest).call(this);
        const stream = await completions.create({
            ...params,
            stream: true
        }, {
            ...options,
            signal: this.controller.signal
        });
        this._connected();
        for await (const chunk of stream){
            __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_addChunk).call(this, chunk);
        }
        if (stream.controller.signal?.aborted) {
            throw new error_1.APIUserAbortError();
        }
        return this._addChatCompletion(__classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_endRequest).call(this));
    }
    async _fromReadableStream(readableStream, options) {
        const signal = options?.signal;
        if (signal) {
            if (signal.aborted) this.controller.abort();
            signal.addEventListener('abort', ()=>this.controller.abort());
        }
        __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_beginRequest).call(this);
        this._connected();
        const stream = streaming_1.Stream.fromReadableStream(readableStream, this.controller);
        let chatId;
        for await (const chunk of stream){
            if (chatId && chatId !== chunk.id) {
                // A new request has been made.
                this._addChatCompletion(__classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_endRequest).call(this));
            }
            __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_addChunk).call(this, chunk);
            chatId = chunk.id;
        }
        if (stream.controller.signal?.aborted) {
            throw new error_1.APIUserAbortError();
        }
        return this._addChatCompletion(__classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_endRequest).call(this));
    }
    [(_ChatCompletionStream_currentChatCompletionSnapshot = new WeakMap(), _ChatCompletionStream_instances = new WeakSet(), _ChatCompletionStream_beginRequest = function _ChatCompletionStream_beginRequest() {
        if (this.ended) return;
        __classPrivateFieldSet(this, _ChatCompletionStream_currentChatCompletionSnapshot, undefined, "f");
    }, _ChatCompletionStream_addChunk = function _ChatCompletionStream_addChunk(chunk) {
        if (this.ended) return;
        const completion = __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_accumulateChatCompletion).call(this, chunk);
        this._emit('chunk', chunk, completion);
        const delta = chunk.choices[0]?.delta?.content;
        const snapshot = completion.choices[0]?.message;
        if (delta != null && snapshot?.role === 'assistant' && snapshot?.content) {
            this._emit('content', delta, snapshot.content);
        }
    }, _ChatCompletionStream_endRequest = function _ChatCompletionStream_endRequest() {
        if (this.ended) {
            throw new error_1.OpenAIError(`stream has ended, this shouldn't happen`);
        }
        const snapshot = __classPrivateFieldGet(this, _ChatCompletionStream_currentChatCompletionSnapshot, "f");
        if (!snapshot) {
            throw new error_1.OpenAIError(`request ended without sending any chunks`);
        }
        __classPrivateFieldSet(this, _ChatCompletionStream_currentChatCompletionSnapshot, undefined, "f");
        return finalizeChatCompletion(snapshot);
    }, _ChatCompletionStream_accumulateChatCompletion = function _ChatCompletionStream_accumulateChatCompletion(chunk) {
        var _a, _b, _c;
        let snapshot = __classPrivateFieldGet(this, _ChatCompletionStream_currentChatCompletionSnapshot, "f");
        const { choices, ...rest } = chunk;
        if (!snapshot) {
            snapshot = __classPrivateFieldSet(this, _ChatCompletionStream_currentChatCompletionSnapshot, {
                ...rest,
                choices: []
            }, "f");
        } else {
            Object.assign(snapshot, rest);
        }
        for (const { delta, finish_reason, index, logprobs = null, ...other } of chunk.choices){
            let choice = snapshot.choices[index];
            if (!choice) {
                choice = snapshot.choices[index] = {
                    finish_reason,
                    index,
                    message: {},
                    logprobs,
                    ...other
                };
            }
            if (logprobs) {
                if (!choice.logprobs) {
                    choice.logprobs = Object.assign({}, logprobs);
                } else {
                    const { content, ...rest } = logprobs;
                    Object.assign(choice.logprobs, rest);
                    if (content) {
                        (_a = choice.logprobs).content ?? (_a.content = []);
                        choice.logprobs.content.push(...content);
                    }
                }
            }
            if (finish_reason) choice.finish_reason = finish_reason;
            Object.assign(choice, other);
            if (!delta) continue; // Shouldn't happen; just in case.
            const { content, function_call, role, tool_calls, ...rest } = delta;
            Object.assign(choice.message, rest);
            if (content) choice.message.content = (choice.message.content || '') + content;
            if (role) choice.message.role = role;
            if (function_call) {
                if (!choice.message.function_call) {
                    choice.message.function_call = function_call;
                } else {
                    if (function_call.name) choice.message.function_call.name = function_call.name;
                    if (function_call.arguments) {
                        (_b = choice.message.function_call).arguments ?? (_b.arguments = '');
                        choice.message.function_call.arguments += function_call.arguments;
                    }
                }
            }
            if (tool_calls) {
                if (!choice.message.tool_calls) choice.message.tool_calls = [];
                for (const { index, id, type, function: fn, ...rest } of tool_calls){
                    const tool_call = (_c = choice.message.tool_calls)[index] ?? (_c[index] = {});
                    Object.assign(tool_call, rest);
                    if (id) tool_call.id = id;
                    if (type) tool_call.type = type;
                    if (fn) tool_call.function ?? (tool_call.function = {
                        arguments: ''
                    });
                    if (fn?.name) tool_call.function.name = fn.name;
                    if (fn?.arguments) tool_call.function.arguments += fn.arguments;
                }
            }
        }
        return snapshot;
    }, Symbol.asyncIterator)]() {
        const pushQueue = [];
        const readQueue = [];
        let done = false;
        this.on('chunk', (chunk)=>{
            const reader = readQueue.shift();
            if (reader) {
                reader.resolve(chunk);
            } else {
                pushQueue.push(chunk);
            }
        });
        this.on('end', ()=>{
            done = true;
            for (const reader of readQueue){
                reader.resolve(undefined);
            }
            readQueue.length = 0;
        });
        this.on('abort', (err)=>{
            done = true;
            for (const reader of readQueue){
                reader.reject(err);
            }
            readQueue.length = 0;
        });
        this.on('error', (err)=>{
            done = true;
            for (const reader of readQueue){
                reader.reject(err);
            }
            readQueue.length = 0;
        });
        return {
            next: async ()=>{
                if (!pushQueue.length) {
                    if (done) {
                        return {
                            value: undefined,
                            done: true
                        };
                    }
                    return new Promise((resolve, reject)=>readQueue.push({
                            resolve,
                            reject
                        })).then((chunk)=>chunk ? {
                            value: chunk,
                            done: false
                        } : {
                            value: undefined,
                            done: true
                        });
                }
                const chunk = pushQueue.shift();
                return {
                    value: chunk,
                    done: false
                };
            },
            return: async ()=>{
                this.abort();
                return {
                    value: undefined,
                    done: true
                };
            }
        };
    }
    toReadableStream() {
        const stream = new streaming_1.Stream(this[Symbol.asyncIterator].bind(this), this.controller);
        return stream.toReadableStream();
    }
}
exports.ChatCompletionStream = ChatCompletionStream;
function finalizeChatCompletion(snapshot) {
    const { id, choices, created, model, system_fingerprint, ...rest } = snapshot;
    return {
        ...rest,
        id,
        choices: choices.map(({ message, finish_reason, index, logprobs, ...choiceRest })=>{
            if (!finish_reason) throw new error_1.OpenAIError(`missing finish_reason for choice ${index}`);
            const { content = null, function_call, tool_calls, ...messageRest } = message;
            const role = message.role; // this is what we expect; in theory it could be different which would make our types a slight lie but would be fine.
            if (!role) throw new error_1.OpenAIError(`missing role for choice ${index}`);
            if (function_call) {
                const { arguments: args, name } = function_call;
                if (args == null) throw new error_1.OpenAIError(`missing function_call.arguments for choice ${index}`);
                if (!name) throw new error_1.OpenAIError(`missing function_call.name for choice ${index}`);
                return {
                    ...choiceRest,
                    message: {
                        content,
                        function_call: {
                            arguments: args,
                            name
                        },
                        role
                    },
                    finish_reason,
                    index,
                    logprobs
                };
            }
            if (tool_calls) {
                return {
                    ...choiceRest,
                    index,
                    finish_reason,
                    logprobs,
                    message: {
                        ...messageRest,
                        role,
                        content,
                        tool_calls: tool_calls.map((tool_call, i)=>{
                            const { function: fn, type, id, ...toolRest } = tool_call;
                            const { arguments: args, name, ...fnRest } = fn || {};
                            if (id == null) throw new error_1.OpenAIError(`missing choices[${index}].tool_calls[${i}].id\n${str(snapshot)}`);
                            if (type == null) throw new error_1.OpenAIError(`missing choices[${index}].tool_calls[${i}].type\n${str(snapshot)}`);
                            if (name == null) throw new error_1.OpenAIError(`missing choices[${index}].tool_calls[${i}].function.name\n${str(snapshot)}`);
                            if (args == null) throw new error_1.OpenAIError(`missing choices[${index}].tool_calls[${i}].function.arguments\n${str(snapshot)}`);
                            return {
                                ...toolRest,
                                id,
                                type,
                                function: {
                                    ...fnRest,
                                    name,
                                    arguments: args
                                }
                            };
                        })
                    }
                };
            }
            return {
                ...choiceRest,
                message: {
                    ...messageRest,
                    content,
                    role
                },
                finish_reason,
                index,
                logprobs
            };
        }),
        created,
        model,
        object: 'chat.completion',
        ...system_fingerprint ? {
            system_fingerprint
        } : {}
    };
}
function str(x) {
    return JSON.stringify(x);
} //# sourceMappingURL=ChatCompletionStream.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/lib/ChatCompletionStreamingRunner.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.ChatCompletionStreamingRunner = void 0;
const ChatCompletionStream_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/lib/ChatCompletionStream.js [app-rsc] (ecmascript)");
class ChatCompletionStreamingRunner extends ChatCompletionStream_1.ChatCompletionStream {
    static fromReadableStream(stream) {
        const runner = new ChatCompletionStreamingRunner();
        runner._run(()=>runner._fromReadableStream(stream));
        return runner;
    }
    /** @deprecated - please use `runTools` instead. */ static runFunctions(completions, params, options) {
        const runner = new ChatCompletionStreamingRunner();
        const opts = {
            ...options,
            headers: {
                ...options?.headers,
                'X-Stainless-Helper-Method': 'runFunctions'
            }
        };
        runner._run(()=>runner._runFunctions(completions, params, opts));
        return runner;
    }
    static runTools(completions, params, options) {
        const runner = new ChatCompletionStreamingRunner();
        const opts = {
            ...options,
            headers: {
                ...options?.headers,
                'X-Stainless-Helper-Method': 'runTools'
            }
        };
        runner._run(()=>runner._runTools(completions, params, opts));
        return runner;
    }
}
exports.ChatCompletionStreamingRunner = ChatCompletionStreamingRunner; //# sourceMappingURL=ChatCompletionStreamingRunner.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/beta/chat/completions.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Completions = exports.ChatCompletionStream = exports.ParsingToolFunction = exports.ParsingFunction = exports.ChatCompletionStreamingRunner = exports.ChatCompletionRunner = void 0;
const resource_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resource.js [app-rsc] (ecmascript)");
const ChatCompletionRunner_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/lib/ChatCompletionRunner.js [app-rsc] (ecmascript)");
var ChatCompletionRunner_2 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/lib/ChatCompletionRunner.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "ChatCompletionRunner", {
    enumerable: true,
    get: function() {
        return ChatCompletionRunner_2.ChatCompletionRunner;
    }
});
const ChatCompletionStreamingRunner_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/lib/ChatCompletionStreamingRunner.js [app-rsc] (ecmascript)");
var ChatCompletionStreamingRunner_2 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/lib/ChatCompletionStreamingRunner.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "ChatCompletionStreamingRunner", {
    enumerable: true,
    get: function() {
        return ChatCompletionStreamingRunner_2.ChatCompletionStreamingRunner;
    }
});
var RunnableFunction_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/lib/RunnableFunction.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "ParsingFunction", {
    enumerable: true,
    get: function() {
        return RunnableFunction_1.ParsingFunction;
    }
});
Object.defineProperty(exports, "ParsingToolFunction", {
    enumerable: true,
    get: function() {
        return RunnableFunction_1.ParsingToolFunction;
    }
});
const ChatCompletionStream_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/lib/ChatCompletionStream.js [app-rsc] (ecmascript)");
var ChatCompletionStream_2 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/lib/ChatCompletionStream.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "ChatCompletionStream", {
    enumerable: true,
    get: function() {
        return ChatCompletionStream_2.ChatCompletionStream;
    }
});
class Completions extends resource_1.APIResource {
    runFunctions(body, options) {
        if (body.stream) {
            return ChatCompletionStreamingRunner_1.ChatCompletionStreamingRunner.runFunctions(this._client.chat.completions, body, options);
        }
        return ChatCompletionRunner_1.ChatCompletionRunner.runFunctions(this._client.chat.completions, body, options);
    }
    runTools(body, options) {
        if (body.stream) {
            return ChatCompletionStreamingRunner_1.ChatCompletionStreamingRunner.runTools(this._client.chat.completions, body, options);
        }
        return ChatCompletionRunner_1.ChatCompletionRunner.runTools(this._client.chat.completions, body, options);
    }
    /**
     * Creates a chat completion stream
     */ stream(body, options) {
        return ChatCompletionStream_1.ChatCompletionStream.createChatCompletion(this._client.chat.completions, body, options);
    }
}
exports.Completions = Completions; //# sourceMappingURL=completions.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/beta/chat/chat.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = this && this.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = {
            enumerable: true,
            get: function() {
                return m[k];
            }
        };
    }
    Object.defineProperty(o, k2, desc);
} : function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
});
var __setModuleDefault = this && this.__setModuleDefault || (Object.create ? function(o, v) {
    Object.defineProperty(o, "default", {
        enumerable: true,
        value: v
    });
} : function(o, v) {
    o["default"] = v;
});
var __importStar = this && this.__importStar || function(mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) {
        for(var k in mod)if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    }
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Chat = void 0;
const resource_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resource.js [app-rsc] (ecmascript)");
const CompletionsAPI = __importStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/beta/chat/completions.js [app-rsc] (ecmascript)"));
class Chat extends resource_1.APIResource {
    constructor(){
        super(...arguments);
        this.completions = new CompletionsAPI.Completions(this._client);
    }
}
exports.Chat = Chat;
(function(Chat) {
    Chat.Completions = CompletionsAPI.Completions;
})(Chat = exports.Chat || (exports.Chat = {})); //# sourceMappingURL=chat.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/lib/AbstractAssistantStreamRunner.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
var __classPrivateFieldSet = this && this.__classPrivateFieldSet || function(receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
};
var __classPrivateFieldGet = this && this.__classPrivateFieldGet || function(receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _AbstractAssistantStreamRunner_connectedPromise, _AbstractAssistantStreamRunner_resolveConnectedPromise, _AbstractAssistantStreamRunner_rejectConnectedPromise, _AbstractAssistantStreamRunner_endPromise, _AbstractAssistantStreamRunner_resolveEndPromise, _AbstractAssistantStreamRunner_rejectEndPromise, _AbstractAssistantStreamRunner_listeners, _AbstractAssistantStreamRunner_ended, _AbstractAssistantStreamRunner_errored, _AbstractAssistantStreamRunner_aborted, _AbstractAssistantStreamRunner_catchingPromiseCreated, _AbstractAssistantStreamRunner_handleError;
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.AbstractAssistantStreamRunner = void 0;
const error_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/error.js [app-rsc] (ecmascript)");
class AbstractAssistantStreamRunner {
    constructor(){
        this.controller = new AbortController();
        _AbstractAssistantStreamRunner_connectedPromise.set(this, void 0);
        _AbstractAssistantStreamRunner_resolveConnectedPromise.set(this, ()=>{});
        _AbstractAssistantStreamRunner_rejectConnectedPromise.set(this, ()=>{});
        _AbstractAssistantStreamRunner_endPromise.set(this, void 0);
        _AbstractAssistantStreamRunner_resolveEndPromise.set(this, ()=>{});
        _AbstractAssistantStreamRunner_rejectEndPromise.set(this, ()=>{});
        _AbstractAssistantStreamRunner_listeners.set(this, {});
        _AbstractAssistantStreamRunner_ended.set(this, false);
        _AbstractAssistantStreamRunner_errored.set(this, false);
        _AbstractAssistantStreamRunner_aborted.set(this, false);
        _AbstractAssistantStreamRunner_catchingPromiseCreated.set(this, false);
        _AbstractAssistantStreamRunner_handleError.set(this, (error)=>{
            __classPrivateFieldSet(this, _AbstractAssistantStreamRunner_errored, true, "f");
            if (error instanceof Error && error.name === 'AbortError') {
                error = new error_1.APIUserAbortError();
            }
            if (error instanceof error_1.APIUserAbortError) {
                __classPrivateFieldSet(this, _AbstractAssistantStreamRunner_aborted, true, "f");
                return this._emit('abort', error);
            }
            if (error instanceof error_1.OpenAIError) {
                return this._emit('error', error);
            }
            if (error instanceof Error) {
                const openAIError = new error_1.OpenAIError(error.message);
                // @ts-ignore
                openAIError.cause = error;
                return this._emit('error', openAIError);
            }
            return this._emit('error', new error_1.OpenAIError(String(error)));
        });
        __classPrivateFieldSet(this, _AbstractAssistantStreamRunner_connectedPromise, new Promise((resolve, reject)=>{
            __classPrivateFieldSet(this, _AbstractAssistantStreamRunner_resolveConnectedPromise, resolve, "f");
            __classPrivateFieldSet(this, _AbstractAssistantStreamRunner_rejectConnectedPromise, reject, "f");
        }), "f");
        __classPrivateFieldSet(this, _AbstractAssistantStreamRunner_endPromise, new Promise((resolve, reject)=>{
            __classPrivateFieldSet(this, _AbstractAssistantStreamRunner_resolveEndPromise, resolve, "f");
            __classPrivateFieldSet(this, _AbstractAssistantStreamRunner_rejectEndPromise, reject, "f");
        }), "f");
        // Don't let these promises cause unhandled rejection errors.
        // we will manually cause an unhandled rejection error later
        // if the user hasn't registered any error listener or called
        // any promise-returning method.
        __classPrivateFieldGet(this, _AbstractAssistantStreamRunner_connectedPromise, "f").catch(()=>{});
        __classPrivateFieldGet(this, _AbstractAssistantStreamRunner_endPromise, "f").catch(()=>{});
    }
    _run(executor) {
        // Unfortunately if we call `executor()` immediately we get runtime errors about
        // references to `this` before the `super()` constructor call returns.
        setTimeout(()=>{
            executor().then(()=>{
                // this._emitFinal();
                this._emit('end');
            }, __classPrivateFieldGet(this, _AbstractAssistantStreamRunner_handleError, "f"));
        }, 0);
    }
    _addRun(run) {
        return run;
    }
    _connected() {
        if (this.ended) return;
        __classPrivateFieldGet(this, _AbstractAssistantStreamRunner_resolveConnectedPromise, "f").call(this);
        this._emit('connect');
    }
    get ended() {
        return __classPrivateFieldGet(this, _AbstractAssistantStreamRunner_ended, "f");
    }
    get errored() {
        return __classPrivateFieldGet(this, _AbstractAssistantStreamRunner_errored, "f");
    }
    get aborted() {
        return __classPrivateFieldGet(this, _AbstractAssistantStreamRunner_aborted, "f");
    }
    abort() {
        this.controller.abort();
    }
    /**
     * Adds the listener function to the end of the listeners array for the event.
     * No checks are made to see if the listener has already been added. Multiple calls passing
     * the same combination of event and listener will result in the listener being added, and
     * called, multiple times.
     * @returns this ChatCompletionStream, so that calls can be chained
     */ on(event, listener) {
        const listeners = __classPrivateFieldGet(this, _AbstractAssistantStreamRunner_listeners, "f")[event] || (__classPrivateFieldGet(this, _AbstractAssistantStreamRunner_listeners, "f")[event] = []);
        listeners.push({
            listener
        });
        return this;
    }
    /**
     * Removes the specified listener from the listener array for the event.
     * off() will remove, at most, one instance of a listener from the listener array. If any single
     * listener has been added multiple times to the listener array for the specified event, then
     * off() must be called multiple times to remove each instance.
     * @returns this ChatCompletionStream, so that calls can be chained
     */ off(event, listener) {
        const listeners = __classPrivateFieldGet(this, _AbstractAssistantStreamRunner_listeners, "f")[event];
        if (!listeners) return this;
        const index = listeners.findIndex((l)=>l.listener === listener);
        if (index >= 0) listeners.splice(index, 1);
        return this;
    }
    /**
     * Adds a one-time listener function for the event. The next time the event is triggered,
     * this listener is removed and then invoked.
     * @returns this ChatCompletionStream, so that calls can be chained
     */ once(event, listener) {
        const listeners = __classPrivateFieldGet(this, _AbstractAssistantStreamRunner_listeners, "f")[event] || (__classPrivateFieldGet(this, _AbstractAssistantStreamRunner_listeners, "f")[event] = []);
        listeners.push({
            listener,
            once: true
        });
        return this;
    }
    /**
     * This is similar to `.once()`, but returns a Promise that resolves the next time
     * the event is triggered, instead of calling a listener callback.
     * @returns a Promise that resolves the next time given event is triggered,
     * or rejects if an error is emitted.  (If you request the 'error' event,
     * returns a promise that resolves with the error).
     *
     * Example:
     *
     *   const message = await stream.emitted('message') // rejects if the stream errors
     */ emitted(event) {
        return new Promise((resolve, reject)=>{
            __classPrivateFieldSet(this, _AbstractAssistantStreamRunner_catchingPromiseCreated, true, "f");
            if (event !== 'error') this.once('error', reject);
            this.once(event, resolve);
        });
    }
    async done() {
        __classPrivateFieldSet(this, _AbstractAssistantStreamRunner_catchingPromiseCreated, true, "f");
        await __classPrivateFieldGet(this, _AbstractAssistantStreamRunner_endPromise, "f");
    }
    _emit(event, ...args) {
        // make sure we don't emit any events after end
        if (__classPrivateFieldGet(this, _AbstractAssistantStreamRunner_ended, "f")) {
            return;
        }
        if (event === 'end') {
            __classPrivateFieldSet(this, _AbstractAssistantStreamRunner_ended, true, "f");
            __classPrivateFieldGet(this, _AbstractAssistantStreamRunner_resolveEndPromise, "f").call(this);
        }
        const listeners = __classPrivateFieldGet(this, _AbstractAssistantStreamRunner_listeners, "f")[event];
        if (listeners) {
            __classPrivateFieldGet(this, _AbstractAssistantStreamRunner_listeners, "f")[event] = listeners.filter((l)=>!l.once);
            listeners.forEach(({ listener })=>listener(...args));
        }
        if (event === 'abort') {
            const error = args[0];
            if (!__classPrivateFieldGet(this, _AbstractAssistantStreamRunner_catchingPromiseCreated, "f") && !listeners?.length) {
                Promise.reject(error);
            }
            __classPrivateFieldGet(this, _AbstractAssistantStreamRunner_rejectConnectedPromise, "f").call(this, error);
            __classPrivateFieldGet(this, _AbstractAssistantStreamRunner_rejectEndPromise, "f").call(this, error);
            this._emit('end');
            return;
        }
        if (event === 'error') {
            // NOTE: _emit('error', error) should only be called from #handleError().
            const error = args[0];
            if (!__classPrivateFieldGet(this, _AbstractAssistantStreamRunner_catchingPromiseCreated, "f") && !listeners?.length) {
                // Trigger an unhandled rejection if the user hasn't registered any error handlers.
                // If you are seeing stack traces here, make sure to handle errors via either:
                // - runner.on('error', () => ...)
                // - await runner.done()
                // - await runner.finalChatCompletion()
                // - etc.
                Promise.reject(error);
            }
            __classPrivateFieldGet(this, _AbstractAssistantStreamRunner_rejectConnectedPromise, "f").call(this, error);
            __classPrivateFieldGet(this, _AbstractAssistantStreamRunner_rejectEndPromise, "f").call(this, error);
            this._emit('end');
        }
    }
    async _threadAssistantStream(body, thread, options) {
        return await this._createThreadAssistantStream(thread, body, options);
    }
    async _runAssistantStream(threadId, runs, params, options) {
        return await this._createAssistantStream(runs, threadId, params, options);
    }
    async _runToolAssistantStream(threadId, runId, runs, params, options) {
        return await this._createToolAssistantStream(runs, threadId, runId, params, options);
    }
    async _createThreadAssistantStream(thread, body, options) {
        const signal = options?.signal;
        if (signal) {
            if (signal.aborted) this.controller.abort();
            signal.addEventListener('abort', ()=>this.controller.abort());
        }
        // this.#validateParams(params);
        const runResult = await thread.createAndRun({
            ...body,
            stream: false
        }, {
            ...options,
            signal: this.controller.signal
        });
        this._connected();
        return this._addRun(runResult);
    }
    async _createToolAssistantStream(run, threadId, runId, params, options) {
        const signal = options?.signal;
        if (signal) {
            if (signal.aborted) this.controller.abort();
            signal.addEventListener('abort', ()=>this.controller.abort());
        }
        const runResult = await run.submitToolOutputs(threadId, runId, {
            ...params,
            stream: false
        }, {
            ...options,
            signal: this.controller.signal
        });
        this._connected();
        return this._addRun(runResult);
    }
    async _createAssistantStream(run, threadId, params, options) {
        const signal = options?.signal;
        if (signal) {
            if (signal.aborted) this.controller.abort();
            signal.addEventListener('abort', ()=>this.controller.abort());
        }
        // this.#validateParams(params);
        const runResult = await run.create(threadId, {
            ...params,
            stream: false
        }, {
            ...options,
            signal: this.controller.signal
        });
        this._connected();
        return this._addRun(runResult);
    }
}
exports.AbstractAssistantStreamRunner = AbstractAssistantStreamRunner;
_AbstractAssistantStreamRunner_connectedPromise = new WeakMap(), _AbstractAssistantStreamRunner_resolveConnectedPromise = new WeakMap(), _AbstractAssistantStreamRunner_rejectConnectedPromise = new WeakMap(), _AbstractAssistantStreamRunner_endPromise = new WeakMap(), _AbstractAssistantStreamRunner_resolveEndPromise = new WeakMap(), _AbstractAssistantStreamRunner_rejectEndPromise = new WeakMap(), _AbstractAssistantStreamRunner_listeners = new WeakMap(), _AbstractAssistantStreamRunner_ended = new WeakMap(), _AbstractAssistantStreamRunner_errored = new WeakMap(), _AbstractAssistantStreamRunner_aborted = new WeakMap(), _AbstractAssistantStreamRunner_catchingPromiseCreated = new WeakMap(), _AbstractAssistantStreamRunner_handleError = new WeakMap(); //# sourceMappingURL=AbstractAssistantStreamRunner.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/lib/AssistantStream.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
var __createBinding = this && this.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = {
            enumerable: true,
            get: function() {
                return m[k];
            }
        };
    }
    Object.defineProperty(o, k2, desc);
} : function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
});
var __setModuleDefault = this && this.__setModuleDefault || (Object.create ? function(o, v) {
    Object.defineProperty(o, "default", {
        enumerable: true,
        value: v
    });
} : function(o, v) {
    o["default"] = v;
});
var __importStar = this && this.__importStar || function(mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) {
        for(var k in mod)if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    }
    __setModuleDefault(result, mod);
    return result;
};
var __classPrivateFieldGet = this && this.__classPrivateFieldGet || function(receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __classPrivateFieldSet = this && this.__classPrivateFieldSet || function(receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
};
var _AssistantStream_instances, _AssistantStream_events, _AssistantStream_runStepSnapshots, _AssistantStream_messageSnapshots, _AssistantStream_messageSnapshot, _AssistantStream_finalRun, _AssistantStream_currentContentIndex, _AssistantStream_currentContent, _AssistantStream_currentToolCallIndex, _AssistantStream_currentToolCall, _AssistantStream_currentEvent, _AssistantStream_currentRunSnapshot, _AssistantStream_currentRunStepSnapshot, _AssistantStream_addEvent, _AssistantStream_endRequest, _AssistantStream_handleMessage, _AssistantStream_handleRunStep, _AssistantStream_handleEvent, _AssistantStream_accumulateRunStep, _AssistantStream_accumulateMessage, _AssistantStream_accumulateContent, _AssistantStream_handleRun;
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.AssistantStream = void 0;
const Core = __importStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/core.js [app-rsc] (ecmascript)"));
const AbstractAssistantStreamRunner_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/lib/AbstractAssistantStreamRunner.js [app-rsc] (ecmascript)");
const streaming_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/streaming.js [app-rsc] (ecmascript)");
const error_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/error.js [app-rsc] (ecmascript)");
class AssistantStream extends AbstractAssistantStreamRunner_1.AbstractAssistantStreamRunner {
    constructor(){
        super(...arguments);
        _AssistantStream_instances.add(this);
        //Track all events in a single list for reference
        _AssistantStream_events.set(this, []);
        //Used to accumulate deltas
        //We are accumulating many types so the value here is not strict
        _AssistantStream_runStepSnapshots.set(this, {});
        _AssistantStream_messageSnapshots.set(this, {});
        _AssistantStream_messageSnapshot.set(this, void 0);
        _AssistantStream_finalRun.set(this, void 0);
        _AssistantStream_currentContentIndex.set(this, void 0);
        _AssistantStream_currentContent.set(this, void 0);
        _AssistantStream_currentToolCallIndex.set(this, void 0);
        _AssistantStream_currentToolCall.set(this, void 0);
        //For current snapshot methods
        _AssistantStream_currentEvent.set(this, void 0);
        _AssistantStream_currentRunSnapshot.set(this, void 0);
        _AssistantStream_currentRunStepSnapshot.set(this, void 0);
    }
    [(_AssistantStream_events = new WeakMap(), _AssistantStream_runStepSnapshots = new WeakMap(), _AssistantStream_messageSnapshots = new WeakMap(), _AssistantStream_messageSnapshot = new WeakMap(), _AssistantStream_finalRun = new WeakMap(), _AssistantStream_currentContentIndex = new WeakMap(), _AssistantStream_currentContent = new WeakMap(), _AssistantStream_currentToolCallIndex = new WeakMap(), _AssistantStream_currentToolCall = new WeakMap(), _AssistantStream_currentEvent = new WeakMap(), _AssistantStream_currentRunSnapshot = new WeakMap(), _AssistantStream_currentRunStepSnapshot = new WeakMap(), _AssistantStream_instances = new WeakSet(), Symbol.asyncIterator)]() {
        const pushQueue = [];
        const readQueue = [];
        let done = false;
        //Catch all for passing along all events
        this.on('event', (event)=>{
            const reader = readQueue.shift();
            if (reader) {
                reader.resolve(event);
            } else {
                pushQueue.push(event);
            }
        });
        this.on('end', ()=>{
            done = true;
            for (const reader of readQueue){
                reader.resolve(undefined);
            }
            readQueue.length = 0;
        });
        this.on('abort', (err)=>{
            done = true;
            for (const reader of readQueue){
                reader.reject(err);
            }
            readQueue.length = 0;
        });
        this.on('error', (err)=>{
            done = true;
            for (const reader of readQueue){
                reader.reject(err);
            }
            readQueue.length = 0;
        });
        return {
            next: async ()=>{
                if (!pushQueue.length) {
                    if (done) {
                        return {
                            value: undefined,
                            done: true
                        };
                    }
                    return new Promise((resolve, reject)=>readQueue.push({
                            resolve,
                            reject
                        })).then((chunk)=>chunk ? {
                            value: chunk,
                            done: false
                        } : {
                            value: undefined,
                            done: true
                        });
                }
                const chunk = pushQueue.shift();
                return {
                    value: chunk,
                    done: false
                };
            },
            return: async ()=>{
                this.abort();
                return {
                    value: undefined,
                    done: true
                };
            }
        };
    }
    static fromReadableStream(stream) {
        const runner = new AssistantStream();
        runner._run(()=>runner._fromReadableStream(stream));
        return runner;
    }
    async _fromReadableStream(readableStream, options) {
        const signal = options?.signal;
        if (signal) {
            if (signal.aborted) this.controller.abort();
            signal.addEventListener('abort', ()=>this.controller.abort());
        }
        this._connected();
        const stream = streaming_1.Stream.fromReadableStream(readableStream, this.controller);
        for await (const event of stream){
            __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_addEvent).call(this, event);
        }
        if (stream.controller.signal?.aborted) {
            throw new error_1.APIUserAbortError();
        }
        return this._addRun(__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_endRequest).call(this));
    }
    toReadableStream() {
        const stream = new streaming_1.Stream(this[Symbol.asyncIterator].bind(this), this.controller);
        return stream.toReadableStream();
    }
    static createToolAssistantStream(threadId, runId, runs, body, options) {
        const runner = new AssistantStream();
        runner._run(()=>runner._runToolAssistantStream(threadId, runId, runs, body, {
                ...options,
                headers: {
                    ...options?.headers,
                    'X-Stainless-Helper-Method': 'stream'
                }
            }));
        return runner;
    }
    async _createToolAssistantStream(run, threadId, runId, params, options) {
        const signal = options?.signal;
        if (signal) {
            if (signal.aborted) this.controller.abort();
            signal.addEventListener('abort', ()=>this.controller.abort());
        }
        const body = {
            ...params,
            stream: true
        };
        const stream = await run.submitToolOutputs(threadId, runId, body, {
            ...options,
            signal: this.controller.signal
        });
        this._connected();
        for await (const event of stream){
            __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_addEvent).call(this, event);
        }
        if (stream.controller.signal?.aborted) {
            throw new error_1.APIUserAbortError();
        }
        return this._addRun(__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_endRequest).call(this));
    }
    static createThreadAssistantStream(body, thread, options) {
        const runner = new AssistantStream();
        runner._run(()=>runner._threadAssistantStream(body, thread, {
                ...options,
                headers: {
                    ...options?.headers,
                    'X-Stainless-Helper-Method': 'stream'
                }
            }));
        return runner;
    }
    static createAssistantStream(threadId, runs, params, options) {
        const runner = new AssistantStream();
        runner._run(()=>runner._runAssistantStream(threadId, runs, params, {
                ...options,
                headers: {
                    ...options?.headers,
                    'X-Stainless-Helper-Method': 'stream'
                }
            }));
        return runner;
    }
    currentEvent() {
        return __classPrivateFieldGet(this, _AssistantStream_currentEvent, "f");
    }
    currentRun() {
        return __classPrivateFieldGet(this, _AssistantStream_currentRunSnapshot, "f");
    }
    currentMessageSnapshot() {
        return __classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f");
    }
    currentRunStepSnapshot() {
        return __classPrivateFieldGet(this, _AssistantStream_currentRunStepSnapshot, "f");
    }
    async finalRunSteps() {
        await this.done();
        return Object.values(__classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f"));
    }
    async finalMessages() {
        await this.done();
        return Object.values(__classPrivateFieldGet(this, _AssistantStream_messageSnapshots, "f"));
    }
    async finalRun() {
        await this.done();
        if (!__classPrivateFieldGet(this, _AssistantStream_finalRun, "f")) throw Error('Final run was not received.');
        return __classPrivateFieldGet(this, _AssistantStream_finalRun, "f");
    }
    async _createThreadAssistantStream(thread, params, options) {
        const signal = options?.signal;
        if (signal) {
            if (signal.aborted) this.controller.abort();
            signal.addEventListener('abort', ()=>this.controller.abort());
        }
        const body = {
            ...params,
            stream: true
        };
        const stream = await thread.createAndRun(body, {
            ...options,
            signal: this.controller.signal
        });
        this._connected();
        for await (const event of stream){
            __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_addEvent).call(this, event);
        }
        if (stream.controller.signal?.aborted) {
            throw new error_1.APIUserAbortError();
        }
        return this._addRun(__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_endRequest).call(this));
    }
    async _createAssistantStream(run, threadId, params, options) {
        const signal = options?.signal;
        if (signal) {
            if (signal.aborted) this.controller.abort();
            signal.addEventListener('abort', ()=>this.controller.abort());
        }
        const body = {
            ...params,
            stream: true
        };
        const stream = await run.create(threadId, body, {
            ...options,
            signal: this.controller.signal
        });
        this._connected();
        for await (const event of stream){
            __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_addEvent).call(this, event);
        }
        if (stream.controller.signal?.aborted) {
            throw new error_1.APIUserAbortError();
        }
        return this._addRun(__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_endRequest).call(this));
    }
    static accumulateDelta(acc, delta) {
        for (const [key, deltaValue] of Object.entries(delta)){
            if (!acc.hasOwnProperty(key)) {
                acc[key] = deltaValue;
                continue;
            }
            let accValue = acc[key];
            if (accValue === null || accValue === undefined) {
                acc[key] = deltaValue;
                continue;
            }
            // We don't accumulate these special properties
            if (key === 'index' || key === 'type') {
                acc[key] = deltaValue;
                continue;
            }
            // Type-specific accumulation logic
            if (typeof accValue === 'string' && typeof deltaValue === 'string') {
                accValue += deltaValue;
            } else if (typeof accValue === 'number' && typeof deltaValue === 'number') {
                accValue += deltaValue;
            } else if (Core.isObj(accValue) && Core.isObj(deltaValue)) {
                accValue = this.accumulateDelta(accValue, deltaValue);
            } else if (Array.isArray(accValue) && Array.isArray(deltaValue)) {
                if (accValue.every((x)=>typeof x === 'string' || typeof x === 'number')) {
                    accValue.push(...deltaValue); // Use spread syntax for efficient addition
                    continue;
                }
            } else {
                throw Error(`Unhandled record type: ${key}, deltaValue: ${deltaValue}, accValue: ${accValue}`);
            }
            acc[key] = accValue;
        }
        return acc;
    }
}
exports.AssistantStream = AssistantStream;
_AssistantStream_addEvent = function _AssistantStream_addEvent(event) {
    if (this.ended) return;
    __classPrivateFieldSet(this, _AssistantStream_currentEvent, event, "f");
    __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_handleEvent).call(this, event);
    switch(event.event){
        case 'thread.created':
            break;
        case 'thread.run.created':
        case 'thread.run.queued':
        case 'thread.run.in_progress':
        case 'thread.run.requires_action':
        case 'thread.run.completed':
        case 'thread.run.failed':
        case 'thread.run.cancelling':
        case 'thread.run.cancelled':
        case 'thread.run.expired':
            __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_handleRun).call(this, event);
            break;
        case 'thread.run.step.created':
        case 'thread.run.step.in_progress':
        case 'thread.run.step.delta':
        case 'thread.run.step.completed':
        case 'thread.run.step.failed':
        case 'thread.run.step.cancelled':
        case 'thread.run.step.expired':
            __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_handleRunStep).call(this, event);
            break;
        case 'thread.message.created':
        case 'thread.message.in_progress':
        case 'thread.message.delta':
        case 'thread.message.completed':
        case 'thread.message.incomplete':
            __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_handleMessage).call(this, event);
            break;
        case 'error':
            //This is included for completeness, but errors are processed in the SSE event processing so this should not occur
            throw new Error('Encountered an error event in event processing - errors should be processed earlier');
    }
}, _AssistantStream_endRequest = function _AssistantStream_endRequest() {
    if (this.ended) {
        throw new error_1.OpenAIError(`stream has ended, this shouldn't happen`);
    }
    if (!__classPrivateFieldGet(this, _AssistantStream_finalRun, "f")) throw Error('Final run has not been received');
    return __classPrivateFieldGet(this, _AssistantStream_finalRun, "f");
}, _AssistantStream_handleMessage = function _AssistantStream_handleMessage(event) {
    const [accumulatedMessage, newContent] = __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_accumulateMessage).call(this, event, __classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f"));
    __classPrivateFieldSet(this, _AssistantStream_messageSnapshot, accumulatedMessage, "f");
    __classPrivateFieldGet(this, _AssistantStream_messageSnapshots, "f")[accumulatedMessage.id] = accumulatedMessage;
    for (const content of newContent){
        const snapshotContent = accumulatedMessage.content[content.index];
        if (snapshotContent?.type == 'text') {
            this._emit('textCreated', snapshotContent.text);
        }
    }
    switch(event.event){
        case 'thread.message.created':
            this._emit('messageCreated', event.data);
            break;
        case 'thread.message.in_progress':
            break;
        case 'thread.message.delta':
            this._emit('messageDelta', event.data.delta, accumulatedMessage);
            if (event.data.delta.content) {
                for (const content of event.data.delta.content){
                    //If it is text delta, emit a text delta event
                    if (content.type == 'text' && content.text) {
                        let textDelta = content.text;
                        let snapshot = accumulatedMessage.content[content.index];
                        if (snapshot && snapshot.type == 'text') {
                            this._emit('textDelta', textDelta, snapshot.text);
                        } else {
                            throw Error('The snapshot associated with this text delta is not text or missing');
                        }
                    }
                    if (content.index != __classPrivateFieldGet(this, _AssistantStream_currentContentIndex, "f")) {
                        //See if we have in progress content
                        if (__classPrivateFieldGet(this, _AssistantStream_currentContent, "f")) {
                            switch(__classPrivateFieldGet(this, _AssistantStream_currentContent, "f").type){
                                case 'text':
                                    this._emit('textDone', __classPrivateFieldGet(this, _AssistantStream_currentContent, "f").text, __classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f"));
                                    break;
                                case 'image_file':
                                    this._emit('imageFileDone', __classPrivateFieldGet(this, _AssistantStream_currentContent, "f").image_file, __classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f"));
                                    break;
                            }
                        }
                        __classPrivateFieldSet(this, _AssistantStream_currentContentIndex, content.index, "f");
                    }
                    __classPrivateFieldSet(this, _AssistantStream_currentContent, accumulatedMessage.content[content.index], "f");
                }
            }
            break;
        case 'thread.message.completed':
        case 'thread.message.incomplete':
            //We emit the latest content we were working on on completion (including incomplete)
            if (__classPrivateFieldGet(this, _AssistantStream_currentContentIndex, "f") !== undefined) {
                const currentContent = event.data.content[__classPrivateFieldGet(this, _AssistantStream_currentContentIndex, "f")];
                if (currentContent) {
                    switch(currentContent.type){
                        case 'image_file':
                            this._emit('imageFileDone', currentContent.image_file, __classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f"));
                            break;
                        case 'text':
                            this._emit('textDone', currentContent.text, __classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f"));
                            break;
                    }
                }
            }
            if (__classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f")) {
                this._emit('messageDone', event.data);
            }
            __classPrivateFieldSet(this, _AssistantStream_messageSnapshot, undefined, "f");
    }
}, _AssistantStream_handleRunStep = function _AssistantStream_handleRunStep(event) {
    const accumulatedRunStep = __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_accumulateRunStep).call(this, event);
    __classPrivateFieldSet(this, _AssistantStream_currentRunStepSnapshot, accumulatedRunStep, "f");
    switch(event.event){
        case 'thread.run.step.created':
            this._emit('runStepCreated', event.data);
            break;
        case 'thread.run.step.delta':
            const delta = event.data.delta;
            if (delta.step_details && delta.step_details.type == 'tool_calls' && delta.step_details.tool_calls && accumulatedRunStep.step_details.type == 'tool_calls') {
                for (const toolCall of delta.step_details.tool_calls){
                    if (toolCall.index == __classPrivateFieldGet(this, _AssistantStream_currentToolCallIndex, "f")) {
                        this._emit('toolCallDelta', toolCall, accumulatedRunStep.step_details.tool_calls[toolCall.index]);
                    } else {
                        if (__classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f")) {
                            this._emit('toolCallDone', __classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f"));
                        }
                        __classPrivateFieldSet(this, _AssistantStream_currentToolCallIndex, toolCall.index, "f");
                        __classPrivateFieldSet(this, _AssistantStream_currentToolCall, accumulatedRunStep.step_details.tool_calls[toolCall.index], "f");
                        if (__classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f")) this._emit('toolCallCreated', __classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f"));
                    }
                }
            }
            this._emit('runStepDelta', event.data.delta, accumulatedRunStep);
            break;
        case 'thread.run.step.completed':
        case 'thread.run.step.failed':
        case 'thread.run.step.cancelled':
        case 'thread.run.step.expired':
            __classPrivateFieldSet(this, _AssistantStream_currentRunStepSnapshot, undefined, "f");
            const details = event.data.step_details;
            if (details.type == 'tool_calls') {
                if (__classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f")) {
                    this._emit('toolCallDone', __classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f"));
                    __classPrivateFieldSet(this, _AssistantStream_currentToolCall, undefined, "f");
                }
            }
            this._emit('runStepDone', event.data, accumulatedRunStep);
            break;
        case 'thread.run.step.in_progress':
            break;
    }
}, _AssistantStream_handleEvent = function _AssistantStream_handleEvent(event) {
    __classPrivateFieldGet(this, _AssistantStream_events, "f").push(event);
    this._emit('event', event);
}, _AssistantStream_accumulateRunStep = function _AssistantStream_accumulateRunStep(event) {
    switch(event.event){
        case 'thread.run.step.created':
            __classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id] = event.data;
            return event.data;
        case 'thread.run.step.delta':
            let snapshot = __classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id];
            if (!snapshot) {
                throw Error('Received a RunStepDelta before creation of a snapshot');
            }
            let data = event.data;
            if (data.delta) {
                const accumulated = AssistantStream.accumulateDelta(snapshot, data.delta);
                __classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id] = accumulated;
            }
            return __classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id];
        case 'thread.run.step.completed':
        case 'thread.run.step.failed':
        case 'thread.run.step.cancelled':
        case 'thread.run.step.expired':
        case 'thread.run.step.in_progress':
            __classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id] = event.data;
            break;
    }
    if (__classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id]) return __classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id];
    throw new Error('No snapshot available');
}, _AssistantStream_accumulateMessage = function _AssistantStream_accumulateMessage(event, snapshot) {
    let newContent = [];
    switch(event.event){
        case 'thread.message.created':
            //On creation the snapshot is just the initial message
            return [
                event.data,
                newContent
            ];
        case 'thread.message.delta':
            if (!snapshot) {
                throw Error('Received a delta with no existing snapshot (there should be one from message creation)');
            }
            let data = event.data;
            //If this delta does not have content, nothing to process
            if (data.delta.content) {
                for (const contentElement of data.delta.content){
                    if (contentElement.index in snapshot.content) {
                        let currentContent = snapshot.content[contentElement.index];
                        snapshot.content[contentElement.index] = __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_accumulateContent).call(this, contentElement, currentContent);
                    } else {
                        snapshot.content[contentElement.index] = contentElement;
                        //This is a new element
                        newContent.push(contentElement);
                    }
                }
            }
            return [
                snapshot,
                newContent
            ];
        case 'thread.message.in_progress':
        case 'thread.message.completed':
        case 'thread.message.incomplete':
            //No changes on other thread events
            if (snapshot) {
                return [
                    snapshot,
                    newContent
                ];
            } else {
                throw Error('Received thread message event with no existing snapshot');
            }
    }
    throw Error('Tried to accumulate a non-message event');
}, _AssistantStream_accumulateContent = function _AssistantStream_accumulateContent(contentElement, currentContent) {
    return AssistantStream.accumulateDelta(currentContent, contentElement);
}, _AssistantStream_handleRun = function _AssistantStream_handleRun(event) {
    __classPrivateFieldSet(this, _AssistantStream_currentRunSnapshot, event.data, "f");
    switch(event.event){
        case 'thread.run.created':
            break;
        case 'thread.run.queued':
            break;
        case 'thread.run.in_progress':
            break;
        case 'thread.run.requires_action':
        case 'thread.run.cancelled':
        case 'thread.run.failed':
        case 'thread.run.completed':
        case 'thread.run.expired':
            __classPrivateFieldSet(this, _AssistantStream_finalRun, event.data, "f");
            if (__classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f")) {
                this._emit('toolCallDone', __classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f"));
                __classPrivateFieldSet(this, _AssistantStream_currentToolCall, undefined, "f");
            }
            break;
        case 'thread.run.cancelling':
            break;
    }
}; //# sourceMappingURL=AssistantStream.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/beta/threads/messages/files.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = this && this.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = {
            enumerable: true,
            get: function() {
                return m[k];
            }
        };
    }
    Object.defineProperty(o, k2, desc);
} : function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
});
var __setModuleDefault = this && this.__setModuleDefault || (Object.create ? function(o, v) {
    Object.defineProperty(o, "default", {
        enumerable: true,
        value: v
    });
} : function(o, v) {
    o["default"] = v;
});
var __importStar = this && this.__importStar || function(mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) {
        for(var k in mod)if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    }
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.MessageFilesPage = exports.Files = void 0;
const resource_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resource.js [app-rsc] (ecmascript)");
const core_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/core.js [app-rsc] (ecmascript)");
const FilesAPI = __importStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/beta/threads/messages/files.js [app-rsc] (ecmascript)"));
const pagination_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/pagination.js [app-rsc] (ecmascript)");
class Files extends resource_1.APIResource {
    /**
     * Retrieves a message file.
     */ retrieve(threadId, messageId, fileId, options) {
        return this._client.get(`/threads/${threadId}/messages/${messageId}/files/${fileId}`, {
            ...options,
            headers: {
                'OpenAI-Beta': 'assistants=v1',
                ...options?.headers
            }
        });
    }
    list(threadId, messageId, query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.list(threadId, messageId, {}, query);
        }
        return this._client.getAPIList(`/threads/${threadId}/messages/${messageId}/files`, MessageFilesPage, {
            query,
            ...options,
            headers: {
                'OpenAI-Beta': 'assistants=v1',
                ...options?.headers
            }
        });
    }
}
exports.Files = Files;
class MessageFilesPage extends pagination_1.CursorPage {
}
exports.MessageFilesPage = MessageFilesPage;
(function(Files) {
    Files.MessageFilesPage = FilesAPI.MessageFilesPage;
})(Files = exports.Files || (exports.Files = {})); //# sourceMappingURL=files.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/beta/threads/messages/messages.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = this && this.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = {
            enumerable: true,
            get: function() {
                return m[k];
            }
        };
    }
    Object.defineProperty(o, k2, desc);
} : function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
});
var __setModuleDefault = this && this.__setModuleDefault || (Object.create ? function(o, v) {
    Object.defineProperty(o, "default", {
        enumerable: true,
        value: v
    });
} : function(o, v) {
    o["default"] = v;
});
var __importStar = this && this.__importStar || function(mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) {
        for(var k in mod)if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    }
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.MessagesPage = exports.Messages = void 0;
const resource_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resource.js [app-rsc] (ecmascript)");
const core_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/core.js [app-rsc] (ecmascript)");
const MessagesAPI = __importStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/beta/threads/messages/messages.js [app-rsc] (ecmascript)"));
const FilesAPI = __importStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/beta/threads/messages/files.js [app-rsc] (ecmascript)"));
const pagination_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/pagination.js [app-rsc] (ecmascript)");
class Messages extends resource_1.APIResource {
    constructor(){
        super(...arguments);
        this.files = new FilesAPI.Files(this._client);
    }
    /**
     * Create a message.
     */ create(threadId, body, options) {
        return this._client.post(`/threads/${threadId}/messages`, {
            body,
            ...options,
            headers: {
                'OpenAI-Beta': 'assistants=v1',
                ...options?.headers
            }
        });
    }
    /**
     * Retrieve a message.
     */ retrieve(threadId, messageId, options) {
        return this._client.get(`/threads/${threadId}/messages/${messageId}`, {
            ...options,
            headers: {
                'OpenAI-Beta': 'assistants=v1',
                ...options?.headers
            }
        });
    }
    /**
     * Modifies a message.
     */ update(threadId, messageId, body, options) {
        return this._client.post(`/threads/${threadId}/messages/${messageId}`, {
            body,
            ...options,
            headers: {
                'OpenAI-Beta': 'assistants=v1',
                ...options?.headers
            }
        });
    }
    list(threadId, query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.list(threadId, {}, query);
        }
        return this._client.getAPIList(`/threads/${threadId}/messages`, MessagesPage, {
            query,
            ...options,
            headers: {
                'OpenAI-Beta': 'assistants=v1',
                ...options?.headers
            }
        });
    }
}
exports.Messages = Messages;
class MessagesPage extends pagination_1.CursorPage {
}
exports.MessagesPage = MessagesPage;
(function(Messages) {
    Messages.MessagesPage = MessagesAPI.MessagesPage;
    Messages.Files = FilesAPI.Files;
    Messages.MessageFilesPage = FilesAPI.MessageFilesPage;
})(Messages = exports.Messages || (exports.Messages = {})); //# sourceMappingURL=messages.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/beta/threads/runs/steps.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = this && this.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = {
            enumerable: true,
            get: function() {
                return m[k];
            }
        };
    }
    Object.defineProperty(o, k2, desc);
} : function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
});
var __setModuleDefault = this && this.__setModuleDefault || (Object.create ? function(o, v) {
    Object.defineProperty(o, "default", {
        enumerable: true,
        value: v
    });
} : function(o, v) {
    o["default"] = v;
});
var __importStar = this && this.__importStar || function(mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) {
        for(var k in mod)if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    }
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.RunStepsPage = exports.Steps = void 0;
const resource_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resource.js [app-rsc] (ecmascript)");
const core_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/core.js [app-rsc] (ecmascript)");
const StepsAPI = __importStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/beta/threads/runs/steps.js [app-rsc] (ecmascript)"));
const pagination_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/pagination.js [app-rsc] (ecmascript)");
class Steps extends resource_1.APIResource {
    /**
     * Retrieves a run step.
     */ retrieve(threadId, runId, stepId, options) {
        return this._client.get(`/threads/${threadId}/runs/${runId}/steps/${stepId}`, {
            ...options,
            headers: {
                'OpenAI-Beta': 'assistants=v1',
                ...options?.headers
            }
        });
    }
    list(threadId, runId, query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.list(threadId, runId, {}, query);
        }
        return this._client.getAPIList(`/threads/${threadId}/runs/${runId}/steps`, RunStepsPage, {
            query,
            ...options,
            headers: {
                'OpenAI-Beta': 'assistants=v1',
                ...options?.headers
            }
        });
    }
}
exports.Steps = Steps;
class RunStepsPage extends pagination_1.CursorPage {
}
exports.RunStepsPage = RunStepsPage;
(function(Steps) {
    Steps.RunStepsPage = StepsAPI.RunStepsPage;
})(Steps = exports.Steps || (exports.Steps = {})); //# sourceMappingURL=steps.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/beta/threads/runs/runs.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = this && this.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = {
            enumerable: true,
            get: function() {
                return m[k];
            }
        };
    }
    Object.defineProperty(o, k2, desc);
} : function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
});
var __setModuleDefault = this && this.__setModuleDefault || (Object.create ? function(o, v) {
    Object.defineProperty(o, "default", {
        enumerable: true,
        value: v
    });
} : function(o, v) {
    o["default"] = v;
});
var __importStar = this && this.__importStar || function(mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) {
        for(var k in mod)if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    }
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.RunsPage = exports.Runs = void 0;
const resource_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resource.js [app-rsc] (ecmascript)");
const core_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/core.js [app-rsc] (ecmascript)");
const AssistantStream_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/lib/AssistantStream.js [app-rsc] (ecmascript)");
const core_2 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/core.js [app-rsc] (ecmascript)");
const RunsAPI = __importStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/beta/threads/runs/runs.js [app-rsc] (ecmascript)"));
const StepsAPI = __importStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/beta/threads/runs/steps.js [app-rsc] (ecmascript)"));
const pagination_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/pagination.js [app-rsc] (ecmascript)");
class Runs extends resource_1.APIResource {
    constructor(){
        super(...arguments);
        this.steps = new StepsAPI.Steps(this._client);
    }
    create(threadId, body, options) {
        return this._client.post(`/threads/${threadId}/runs`, {
            body,
            ...options,
            headers: {
                'OpenAI-Beta': 'assistants=v1',
                ...options?.headers
            },
            stream: body.stream ?? false
        });
    }
    /**
     * Retrieves a run.
     */ retrieve(threadId, runId, options) {
        return this._client.get(`/threads/${threadId}/runs/${runId}`, {
            ...options,
            headers: {
                'OpenAI-Beta': 'assistants=v1',
                ...options?.headers
            }
        });
    }
    /**
     * Modifies a run.
     */ update(threadId, runId, body, options) {
        return this._client.post(`/threads/${threadId}/runs/${runId}`, {
            body,
            ...options,
            headers: {
                'OpenAI-Beta': 'assistants=v1',
                ...options?.headers
            }
        });
    }
    list(threadId, query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.list(threadId, {}, query);
        }
        return this._client.getAPIList(`/threads/${threadId}/runs`, RunsPage, {
            query,
            ...options,
            headers: {
                'OpenAI-Beta': 'assistants=v1',
                ...options?.headers
            }
        });
    }
    /**
     * Cancels a run that is `in_progress`.
     */ cancel(threadId, runId, options) {
        return this._client.post(`/threads/${threadId}/runs/${runId}/cancel`, {
            ...options,
            headers: {
                'OpenAI-Beta': 'assistants=v1',
                ...options?.headers
            }
        });
    }
    /**
     * A helper to create a run an poll for a terminal state. More information on Run
     * lifecycles can be found here:
     * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
     */ async createAndPoll(threadId, body, options) {
        const run = await this.create(threadId, body, options);
        return await this.poll(threadId, run.id, options);
    }
    /**
     * Create a Run stream
     *
     * @deprecated use `stream` instead
     */ createAndStream(threadId, body, options) {
        return AssistantStream_1.AssistantStream.createAssistantStream(threadId, this._client.beta.threads.runs, body, options);
    }
    /**
     * A helper to poll a run status until it reaches a terminal state. More
     * information on Run lifecycles can be found here:
     * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
     */ async poll(threadId, runId, options) {
        const headers = {
            ...options?.headers,
            'X-Stainless-Poll-Helper': 'true'
        };
        if (options?.pollIntervalMs) {
            headers['X-Stainless-Custom-Poll-Interval'] = options.pollIntervalMs.toString();
        }
        while(true){
            const { data: run, response } = await this.retrieve(threadId, runId, {
                ...options,
                headers: {
                    ...options?.headers,
                    ...headers
                }
            }).withResponse();
            switch(run.status){
                //If we are in any sort of intermediate state we poll
                case 'queued':
                case 'in_progress':
                case 'cancelling':
                    let sleepInterval = 5000;
                    if (options?.pollIntervalMs) {
                        sleepInterval = options.pollIntervalMs;
                    } else {
                        const headerInterval = response.headers.get('openai-poll-after-ms');
                        if (headerInterval) {
                            const headerIntervalMs = parseInt(headerInterval);
                            if (!isNaN(headerIntervalMs)) {
                                sleepInterval = headerIntervalMs;
                            }
                        }
                    }
                    await (0, core_2.sleep)(sleepInterval);
                    break;
                //We return the run in any terminal state.
                case 'requires_action':
                case 'cancelled':
                case 'completed':
                case 'failed':
                case 'expired':
                    return run;
            }
        }
    }
    /**
     * Create a Run stream
     */ stream(threadId, body, options) {
        return AssistantStream_1.AssistantStream.createAssistantStream(threadId, this._client.beta.threads.runs, body, options);
    }
    submitToolOutputs(threadId, runId, body, options) {
        return this._client.post(`/threads/${threadId}/runs/${runId}/submit_tool_outputs`, {
            body,
            ...options,
            headers: {
                'OpenAI-Beta': 'assistants=v1',
                ...options?.headers
            },
            stream: body.stream ?? false
        });
    }
    /**
     * A helper to submit a tool output to a run and poll for a terminal run state.
     * More information on Run lifecycles can be found here:
     * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
     */ async submitToolOutputsAndPoll(threadId, runId, body, options) {
        const run = await this.submitToolOutputs(threadId, runId, body, options);
        return await this.poll(threadId, run.id, options);
    }
    /**
     * Submit the tool outputs from a previous run and stream the run to a terminal
     * state. More information on Run lifecycles can be found here:
     * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
     */ submitToolOutputsStream(threadId, runId, body, options) {
        return AssistantStream_1.AssistantStream.createToolAssistantStream(threadId, runId, this._client.beta.threads.runs, body, options);
    }
}
exports.Runs = Runs;
class RunsPage extends pagination_1.CursorPage {
}
exports.RunsPage = RunsPage;
(function(Runs) {
    Runs.RunsPage = RunsAPI.RunsPage;
    Runs.Steps = StepsAPI.Steps;
    Runs.RunStepsPage = StepsAPI.RunStepsPage;
})(Runs = exports.Runs || (exports.Runs = {})); //# sourceMappingURL=runs.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/beta/threads/threads.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = this && this.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = {
            enumerable: true,
            get: function() {
                return m[k];
            }
        };
    }
    Object.defineProperty(o, k2, desc);
} : function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
});
var __setModuleDefault = this && this.__setModuleDefault || (Object.create ? function(o, v) {
    Object.defineProperty(o, "default", {
        enumerable: true,
        value: v
    });
} : function(o, v) {
    o["default"] = v;
});
var __importStar = this && this.__importStar || function(mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) {
        for(var k in mod)if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    }
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Threads = void 0;
const resource_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resource.js [app-rsc] (ecmascript)");
const core_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/core.js [app-rsc] (ecmascript)");
const AssistantStream_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/lib/AssistantStream.js [app-rsc] (ecmascript)");
const MessagesAPI = __importStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/beta/threads/messages/messages.js [app-rsc] (ecmascript)"));
const RunsAPI = __importStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/beta/threads/runs/runs.js [app-rsc] (ecmascript)"));
class Threads extends resource_1.APIResource {
    constructor(){
        super(...arguments);
        this.runs = new RunsAPI.Runs(this._client);
        this.messages = new MessagesAPI.Messages(this._client);
    }
    create(body = {}, options) {
        if ((0, core_1.isRequestOptions)(body)) {
            return this.create({}, body);
        }
        return this._client.post('/threads', {
            body,
            ...options,
            headers: {
                'OpenAI-Beta': 'assistants=v1',
                ...options?.headers
            }
        });
    }
    /**
     * Retrieves a thread.
     */ retrieve(threadId, options) {
        return this._client.get(`/threads/${threadId}`, {
            ...options,
            headers: {
                'OpenAI-Beta': 'assistants=v1',
                ...options?.headers
            }
        });
    }
    /**
     * Modifies a thread.
     */ update(threadId, body, options) {
        return this._client.post(`/threads/${threadId}`, {
            body,
            ...options,
            headers: {
                'OpenAI-Beta': 'assistants=v1',
                ...options?.headers
            }
        });
    }
    /**
     * Delete a thread.
     */ del(threadId, options) {
        return this._client.delete(`/threads/${threadId}`, {
            ...options,
            headers: {
                'OpenAI-Beta': 'assistants=v1',
                ...options?.headers
            }
        });
    }
    createAndRun(body, options) {
        return this._client.post('/threads/runs', {
            body,
            ...options,
            headers: {
                'OpenAI-Beta': 'assistants=v1',
                ...options?.headers
            },
            stream: body.stream ?? false
        });
    }
    /**
     * A helper to create a thread, start a run and then poll for a terminal state.
     * More information on Run lifecycles can be found here:
     * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
     */ async createAndRunPoll(body, options) {
        const run = await this.createAndRun(body, options);
        return await this.runs.poll(run.thread_id, run.id, options);
    }
    /**
     * Create a thread and stream the run back
     */ createAndRunStream(body, options) {
        return AssistantStream_1.AssistantStream.createThreadAssistantStream(body, this._client.beta.threads, options);
    }
}
exports.Threads = Threads;
(function(Threads) {
    Threads.Runs = RunsAPI.Runs;
    Threads.RunsPage = RunsAPI.RunsPage;
    Threads.Messages = MessagesAPI.Messages;
    Threads.MessagesPage = MessagesAPI.MessagesPage;
})(Threads = exports.Threads || (exports.Threads = {})); //# sourceMappingURL=threads.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/beta/beta.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = this && this.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = {
            enumerable: true,
            get: function() {
                return m[k];
            }
        };
    }
    Object.defineProperty(o, k2, desc);
} : function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
});
var __setModuleDefault = this && this.__setModuleDefault || (Object.create ? function(o, v) {
    Object.defineProperty(o, "default", {
        enumerable: true,
        value: v
    });
} : function(o, v) {
    o["default"] = v;
});
var __importStar = this && this.__importStar || function(mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) {
        for(var k in mod)if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    }
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Beta = void 0;
const resource_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resource.js [app-rsc] (ecmascript)");
const AssistantsAPI = __importStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/beta/assistants/assistants.js [app-rsc] (ecmascript)"));
const ChatAPI = __importStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/beta/chat/chat.js [app-rsc] (ecmascript)"));
const ThreadsAPI = __importStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/beta/threads/threads.js [app-rsc] (ecmascript)"));
class Beta extends resource_1.APIResource {
    constructor(){
        super(...arguments);
        this.chat = new ChatAPI.Chat(this._client);
        this.assistants = new AssistantsAPI.Assistants(this._client);
        this.threads = new ThreadsAPI.Threads(this._client);
    }
}
exports.Beta = Beta;
(function(Beta) {
    Beta.Chat = ChatAPI.Chat;
    Beta.Assistants = AssistantsAPI.Assistants;
    Beta.AssistantsPage = AssistantsAPI.AssistantsPage;
    Beta.Threads = ThreadsAPI.Threads;
})(Beta = exports.Beta || (exports.Beta = {})); //# sourceMappingURL=beta.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/completions.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Completions = void 0;
const resource_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resource.js [app-rsc] (ecmascript)");
class Completions extends resource_1.APIResource {
    create(body, options) {
        return this._client.post('/completions', {
            body,
            ...options,
            stream: body.stream ?? false
        });
    }
}
exports.Completions = Completions;
(function(Completions) {})(Completions = exports.Completions || (exports.Completions = {})); //# sourceMappingURL=completions.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/embeddings.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Embeddings = void 0;
const resource_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resource.js [app-rsc] (ecmascript)");
class Embeddings extends resource_1.APIResource {
    /**
     * Creates an embedding vector representing the input text.
     */ create(body, options) {
        return this._client.post('/embeddings', {
            body,
            ...options
        });
    }
}
exports.Embeddings = Embeddings;
(function(Embeddings) {})(Embeddings = exports.Embeddings || (exports.Embeddings = {})); //# sourceMappingURL=embeddings.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/files.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = this && this.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = {
            enumerable: true,
            get: function() {
                return m[k];
            }
        };
    }
    Object.defineProperty(o, k2, desc);
} : function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
});
var __setModuleDefault = this && this.__setModuleDefault || (Object.create ? function(o, v) {
    Object.defineProperty(o, "default", {
        enumerable: true,
        value: v
    });
} : function(o, v) {
    o["default"] = v;
});
var __importStar = this && this.__importStar || function(mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) {
        for(var k in mod)if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    }
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.FileObjectsPage = exports.Files = void 0;
const resource_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resource.js [app-rsc] (ecmascript)");
const core_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/core.js [app-rsc] (ecmascript)");
const core_2 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/core.js [app-rsc] (ecmascript)");
const error_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/error.js [app-rsc] (ecmascript)");
const FilesAPI = __importStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/files.js [app-rsc] (ecmascript)"));
const core_3 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/core.js [app-rsc] (ecmascript)");
const pagination_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/pagination.js [app-rsc] (ecmascript)");
class Files extends resource_1.APIResource {
    /**
     * Upload a file that can be used across various endpoints. The size of all the
     * files uploaded by one organization can be up to 100 GB.
     *
     * The size of individual files can be a maximum of 512 MB or 2 million tokens for
     * Assistants. See the
     * [Assistants Tools guide](https://platform.openai.com/docs/assistants/tools) to
     * learn more about the types of files supported. The Fine-tuning API only supports
     * `.jsonl` files.
     *
     * Please [contact us](https://help.openai.com/) if you need to increase these
     * storage limits.
     */ create(body, options) {
        return this._client.post('/files', (0, core_3.multipartFormRequestOptions)({
            body,
            ...options
        }));
    }
    /**
     * Returns information about a specific file.
     */ retrieve(fileId, options) {
        return this._client.get(`/files/${fileId}`, options);
    }
    list(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.list({}, query);
        }
        return this._client.getAPIList('/files', FileObjectsPage, {
            query,
            ...options
        });
    }
    /**
     * Delete a file.
     */ del(fileId, options) {
        return this._client.delete(`/files/${fileId}`, options);
    }
    /**
     * Returns the contents of the specified file.
     */ content(fileId, options) {
        return this._client.get(`/files/${fileId}/content`, {
            ...options,
            __binaryResponse: true
        });
    }
    /**
     * Returns the contents of the specified file.
     *
     * @deprecated The `.content()` method should be used instead
     */ retrieveContent(fileId, options) {
        return this._client.get(`/files/${fileId}/content`, {
            ...options,
            headers: {
                Accept: 'application/json',
                ...options?.headers
            }
        });
    }
    /**
     * Waits for the given file to be processed, default timeout is 30 mins.
     */ async waitForProcessing(id, { pollInterval = 5000, maxWait = 30 * 60 * 1000 } = {}) {
        const TERMINAL_STATES = new Set([
            'processed',
            'error',
            'deleted'
        ]);
        const start = Date.now();
        let file = await this.retrieve(id);
        while(!file.status || !TERMINAL_STATES.has(file.status)){
            await (0, core_2.sleep)(pollInterval);
            file = await this.retrieve(id);
            if (Date.now() - start > maxWait) {
                throw new error_1.APIConnectionTimeoutError({
                    message: `Giving up on waiting for file ${id} to finish processing after ${maxWait} milliseconds.`
                });
            }
        }
        return file;
    }
}
exports.Files = Files;
/**
 * Note: no pagination actually occurs yet, this is for forwards-compatibility.
 */ class FileObjectsPage extends pagination_1.Page {
}
exports.FileObjectsPage = FileObjectsPage;
(function(Files) {
    Files.FileObjectsPage = FilesAPI.FileObjectsPage;
})(Files = exports.Files || (exports.Files = {})); //# sourceMappingURL=files.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/fine-tuning/jobs/checkpoints.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = this && this.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = {
            enumerable: true,
            get: function() {
                return m[k];
            }
        };
    }
    Object.defineProperty(o, k2, desc);
} : function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
});
var __setModuleDefault = this && this.__setModuleDefault || (Object.create ? function(o, v) {
    Object.defineProperty(o, "default", {
        enumerable: true,
        value: v
    });
} : function(o, v) {
    o["default"] = v;
});
var __importStar = this && this.__importStar || function(mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) {
        for(var k in mod)if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    }
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.FineTuningJobCheckpointsPage = exports.Checkpoints = void 0;
const resource_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resource.js [app-rsc] (ecmascript)");
const core_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/core.js [app-rsc] (ecmascript)");
const CheckpointsAPI = __importStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/fine-tuning/jobs/checkpoints.js [app-rsc] (ecmascript)"));
const pagination_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/pagination.js [app-rsc] (ecmascript)");
class Checkpoints extends resource_1.APIResource {
    list(fineTuningJobId, query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.list(fineTuningJobId, {}, query);
        }
        return this._client.getAPIList(`/fine_tuning/jobs/${fineTuningJobId}/checkpoints`, FineTuningJobCheckpointsPage, {
            query,
            ...options
        });
    }
}
exports.Checkpoints = Checkpoints;
class FineTuningJobCheckpointsPage extends pagination_1.CursorPage {
}
exports.FineTuningJobCheckpointsPage = FineTuningJobCheckpointsPage;
(function(Checkpoints) {
    Checkpoints.FineTuningJobCheckpointsPage = CheckpointsAPI.FineTuningJobCheckpointsPage;
})(Checkpoints = exports.Checkpoints || (exports.Checkpoints = {})); //# sourceMappingURL=checkpoints.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/fine-tuning/jobs/jobs.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = this && this.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = {
            enumerable: true,
            get: function() {
                return m[k];
            }
        };
    }
    Object.defineProperty(o, k2, desc);
} : function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
});
var __setModuleDefault = this && this.__setModuleDefault || (Object.create ? function(o, v) {
    Object.defineProperty(o, "default", {
        enumerable: true,
        value: v
    });
} : function(o, v) {
    o["default"] = v;
});
var __importStar = this && this.__importStar || function(mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) {
        for(var k in mod)if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    }
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.FineTuningJobEventsPage = exports.FineTuningJobsPage = exports.Jobs = void 0;
const resource_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resource.js [app-rsc] (ecmascript)");
const core_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/core.js [app-rsc] (ecmascript)");
const JobsAPI = __importStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/fine-tuning/jobs/jobs.js [app-rsc] (ecmascript)"));
const CheckpointsAPI = __importStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/fine-tuning/jobs/checkpoints.js [app-rsc] (ecmascript)"));
const pagination_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/pagination.js [app-rsc] (ecmascript)");
class Jobs extends resource_1.APIResource {
    constructor(){
        super(...arguments);
        this.checkpoints = new CheckpointsAPI.Checkpoints(this._client);
    }
    /**
     * Creates a fine-tuning job which begins the process of creating a new model from
     * a given dataset.
     *
     * Response includes details of the enqueued job including job status and the name
     * of the fine-tuned models once complete.
     *
     * [Learn more about fine-tuning](https://platform.openai.com/docs/guides/fine-tuning)
     */ create(body, options) {
        return this._client.post('/fine_tuning/jobs', {
            body,
            ...options
        });
    }
    /**
     * Get info about a fine-tuning job.
     *
     * [Learn more about fine-tuning](https://platform.openai.com/docs/guides/fine-tuning)
     */ retrieve(fineTuningJobId, options) {
        return this._client.get(`/fine_tuning/jobs/${fineTuningJobId}`, options);
    }
    list(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.list({}, query);
        }
        return this._client.getAPIList('/fine_tuning/jobs', FineTuningJobsPage, {
            query,
            ...options
        });
    }
    /**
     * Immediately cancel a fine-tune job.
     */ cancel(fineTuningJobId, options) {
        return this._client.post(`/fine_tuning/jobs/${fineTuningJobId}/cancel`, options);
    }
    listEvents(fineTuningJobId, query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.listEvents(fineTuningJobId, {}, query);
        }
        return this._client.getAPIList(`/fine_tuning/jobs/${fineTuningJobId}/events`, FineTuningJobEventsPage, {
            query,
            ...options
        });
    }
}
exports.Jobs = Jobs;
class FineTuningJobsPage extends pagination_1.CursorPage {
}
exports.FineTuningJobsPage = FineTuningJobsPage;
class FineTuningJobEventsPage extends pagination_1.CursorPage {
}
exports.FineTuningJobEventsPage = FineTuningJobEventsPage;
(function(Jobs) {
    Jobs.FineTuningJobsPage = JobsAPI.FineTuningJobsPage;
    Jobs.FineTuningJobEventsPage = JobsAPI.FineTuningJobEventsPage;
    Jobs.Checkpoints = CheckpointsAPI.Checkpoints;
    Jobs.FineTuningJobCheckpointsPage = CheckpointsAPI.FineTuningJobCheckpointsPage;
})(Jobs = exports.Jobs || (exports.Jobs = {})); //# sourceMappingURL=jobs.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/fine-tuning/fine-tuning.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = this && this.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = {
            enumerable: true,
            get: function() {
                return m[k];
            }
        };
    }
    Object.defineProperty(o, k2, desc);
} : function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
});
var __setModuleDefault = this && this.__setModuleDefault || (Object.create ? function(o, v) {
    Object.defineProperty(o, "default", {
        enumerable: true,
        value: v
    });
} : function(o, v) {
    o["default"] = v;
});
var __importStar = this && this.__importStar || function(mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) {
        for(var k in mod)if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    }
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.FineTuning = void 0;
const resource_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resource.js [app-rsc] (ecmascript)");
const JobsAPI = __importStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/fine-tuning/jobs/jobs.js [app-rsc] (ecmascript)"));
class FineTuning extends resource_1.APIResource {
    constructor(){
        super(...arguments);
        this.jobs = new JobsAPI.Jobs(this._client);
    }
}
exports.FineTuning = FineTuning;
(function(FineTuning) {
    FineTuning.Jobs = JobsAPI.Jobs;
    FineTuning.FineTuningJobsPage = JobsAPI.FineTuningJobsPage;
    FineTuning.FineTuningJobEventsPage = JobsAPI.FineTuningJobEventsPage;
})(FineTuning = exports.FineTuning || (exports.FineTuning = {})); //# sourceMappingURL=fine-tuning.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/images.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Images = void 0;
const resource_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resource.js [app-rsc] (ecmascript)");
const core_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/core.js [app-rsc] (ecmascript)");
class Images extends resource_1.APIResource {
    /**
     * Creates a variation of a given image.
     */ createVariation(body, options) {
        return this._client.post('/images/variations', (0, core_1.multipartFormRequestOptions)({
            body,
            ...options
        }));
    }
    /**
     * Creates an edited or extended image given an original image and a prompt.
     */ edit(body, options) {
        return this._client.post('/images/edits', (0, core_1.multipartFormRequestOptions)({
            body,
            ...options
        }));
    }
    /**
     * Creates an image given a prompt.
     */ generate(body, options) {
        return this._client.post('/images/generations', {
            body,
            ...options
        });
    }
}
exports.Images = Images;
(function(Images) {})(Images = exports.Images || (exports.Images = {})); //# sourceMappingURL=images.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/models.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = this && this.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = {
            enumerable: true,
            get: function() {
                return m[k];
            }
        };
    }
    Object.defineProperty(o, k2, desc);
} : function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
});
var __setModuleDefault = this && this.__setModuleDefault || (Object.create ? function(o, v) {
    Object.defineProperty(o, "default", {
        enumerable: true,
        value: v
    });
} : function(o, v) {
    o["default"] = v;
});
var __importStar = this && this.__importStar || function(mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) {
        for(var k in mod)if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    }
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.ModelsPage = exports.Models = void 0;
const resource_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resource.js [app-rsc] (ecmascript)");
const ModelsAPI = __importStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/models.js [app-rsc] (ecmascript)"));
const pagination_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/pagination.js [app-rsc] (ecmascript)");
class Models extends resource_1.APIResource {
    /**
     * Retrieves a model instance, providing basic information about the model such as
     * the owner and permissioning.
     */ retrieve(model, options) {
        return this._client.get(`/models/${model}`, options);
    }
    /**
     * Lists the currently available models, and provides basic information about each
     * one such as the owner and availability.
     */ list(options) {
        return this._client.getAPIList('/models', ModelsPage, options);
    }
    /**
     * Delete a fine-tuned model. You must have the Owner role in your organization to
     * delete a model.
     */ del(model, options) {
        return this._client.delete(`/models/${model}`, options);
    }
}
exports.Models = Models;
/**
 * Note: no pagination actually occurs yet, this is for forwards-compatibility.
 */ class ModelsPage extends pagination_1.Page {
}
exports.ModelsPage = ModelsPage;
(function(Models) {
    Models.ModelsPage = ModelsAPI.ModelsPage;
})(Models = exports.Models || (exports.Models = {})); //# sourceMappingURL=models.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/moderations.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Moderations = void 0;
const resource_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resource.js [app-rsc] (ecmascript)");
class Moderations extends resource_1.APIResource {
    /**
     * Classifies if text is potentially harmful.
     */ create(body, options) {
        return this._client.post('/moderations', {
            body,
            ...options
        });
    }
}
exports.Moderations = Moderations;
(function(Moderations) {})(Moderations = exports.Moderations || (exports.Moderations = {})); //# sourceMappingURL=moderations.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/index.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = this && this.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = {
            enumerable: true,
            get: function() {
                return m[k];
            }
        };
    }
    Object.defineProperty(o, k2, desc);
} : function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
});
var __exportStar = this && this.__exportStar || function(m, exports1) {
    for(var p in m)if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports1, p)) __createBinding(exports1, m, p);
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Moderations = exports.Models = exports.ModelsPage = exports.Images = exports.FineTuning = exports.Files = exports.FileObjectsPage = exports.Embeddings = exports.Completions = exports.Beta = exports.Batches = exports.Audio = void 0;
__exportStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/chat/index.js [app-rsc] (ecmascript)"), exports);
__exportStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/shared.js [app-rsc] (ecmascript)"), exports);
var audio_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/audio/audio.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "Audio", {
    enumerable: true,
    get: function() {
        return audio_1.Audio;
    }
});
var batches_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/batches.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "Batches", {
    enumerable: true,
    get: function() {
        return batches_1.Batches;
    }
});
var beta_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/beta/beta.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "Beta", {
    enumerable: true,
    get: function() {
        return beta_1.Beta;
    }
});
var completions_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/completions.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "Completions", {
    enumerable: true,
    get: function() {
        return completions_1.Completions;
    }
});
var embeddings_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/embeddings.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "Embeddings", {
    enumerable: true,
    get: function() {
        return embeddings_1.Embeddings;
    }
});
var files_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/files.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "FileObjectsPage", {
    enumerable: true,
    get: function() {
        return files_1.FileObjectsPage;
    }
});
Object.defineProperty(exports, "Files", {
    enumerable: true,
    get: function() {
        return files_1.Files;
    }
});
var fine_tuning_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/fine-tuning/fine-tuning.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "FineTuning", {
    enumerable: true,
    get: function() {
        return fine_tuning_1.FineTuning;
    }
});
var images_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/images.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "Images", {
    enumerable: true,
    get: function() {
        return images_1.Images;
    }
});
var models_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/models.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "ModelsPage", {
    enumerable: true,
    get: function() {
        return models_1.ModelsPage;
    }
});
Object.defineProperty(exports, "Models", {
    enumerable: true,
    get: function() {
        return models_1.Models;
    }
});
var moderations_1 = __turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/moderations.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "Moderations", {
    enumerable: true,
    get: function() {
        return moderations_1.Moderations;
    }
}); //# sourceMappingURL=index.js.map
}}),
"[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/index.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = this && this.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = {
            enumerable: true,
            get: function() {
                return m[k];
            }
        };
    }
    Object.defineProperty(o, k2, desc);
} : function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
});
var __setModuleDefault = this && this.__setModuleDefault || (Object.create ? function(o, v) {
    Object.defineProperty(o, "default", {
        enumerable: true,
        value: v
    });
} : function(o, v) {
    o["default"] = v;
});
var __importStar = this && this.__importStar || function(mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) {
        for(var k in mod)if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    }
    __setModuleDefault(result, mod);
    return result;
};
var _a;
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.fileFromPath = exports.toFile = exports.UnprocessableEntityError = exports.PermissionDeniedError = exports.InternalServerError = exports.AuthenticationError = exports.BadRequestError = exports.RateLimitError = exports.ConflictError = exports.NotFoundError = exports.APIUserAbortError = exports.APIConnectionTimeoutError = exports.APIConnectionError = exports.APIError = exports.OpenAIError = exports.OpenAI = void 0;
const Core = __importStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/core.js [app-rsc] (ecmascript)"));
const Errors = __importStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/error.js [app-rsc] (ecmascript)"));
const Uploads = __importStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/uploads.js [app-rsc] (ecmascript)"));
const Pagination = __importStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/pagination.js [app-rsc] (ecmascript)"));
const API = __importStar(__turbopack_require__("[project]/node_modules/.pnpm/openai@4.36.0_encoding@0.1.13/node_modules/openai/resources/index.js [app-rsc] (ecmascript)"));
/** API Client for interfacing with the OpenAI API. */ class OpenAI extends Core.APIClient {
    /**
     * API Client for interfacing with the OpenAI API.
     *
     * @param {string | undefined} [opts.apiKey=process.env['OPENAI_API_KEY'] ?? undefined]
     * @param {string | null | undefined} [opts.organization=process.env['OPENAI_ORG_ID'] ?? null]
     * @param {string | null | undefined} [opts.project=process.env['OPENAI_PROJECT_ID'] ?? null]
     * @param {string} [opts.baseURL=process.env['OPENAI_BASE_URL'] ?? https://api.openai.com/v1] - Override the default base URL for the API.
     * @param {number} [opts.timeout=10 minutes] - The maximum amount of time (in milliseconds) the client will wait for a response before timing out.
     * @param {number} [opts.httpAgent] - An HTTP agent used to manage HTTP(s) connections.
     * @param {Core.Fetch} [opts.fetch] - Specify a custom `fetch` function implementation.
     * @param {number} [opts.maxRetries=2] - The maximum number of times the client will retry a request.
     * @param {Core.Headers} opts.defaultHeaders - Default headers to include with every request to the API.
     * @param {Core.DefaultQuery} opts.defaultQuery - Default query parameters to include with every request to the API.
     * @param {boolean} [opts.dangerouslyAllowBrowser=false] - By default, client-side use of this library is not allowed, as it risks exposing your secret API credentials to attackers.
     */ constructor({ baseURL = Core.readEnv('OPENAI_BASE_URL'), apiKey = Core.readEnv('OPENAI_API_KEY'), organization = Core.readEnv('OPENAI_ORG_ID') ?? null, project = Core.readEnv('OPENAI_PROJECT_ID') ?? null, ...opts } = {}){
        if (apiKey === undefined) {
            throw new Errors.OpenAIError("The OPENAI_API_KEY environment variable is missing or empty; either provide it, or instantiate the OpenAI client with an apiKey option, like new OpenAI({ apiKey: 'My API Key' }).");
        }
        const options = {
            apiKey,
            organization,
            project,
            ...opts,
            baseURL: baseURL || `https://api.openai.com/v1`
        };
        if (!options.dangerouslyAllowBrowser && Core.isRunningInBrowser()) {
            throw new Errors.OpenAIError("It looks like you're running in a browser-like environment.\n\nThis is disabled by default, as it risks exposing your secret API credentials to attackers.\nIf you understand the risks and have appropriate mitigations in place,\nyou can set the `dangerouslyAllowBrowser` option to `true`, e.g.,\n\nnew OpenAI({ apiKey, dangerouslyAllowBrowser: true });\n\nhttps://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety\n");
        }
        super({
            baseURL: options.baseURL,
            timeout: options.timeout ?? 600000 /* 10 minutes */ ,
            httpAgent: options.httpAgent,
            maxRetries: options.maxRetries,
            fetch: options.fetch
        });
        this.completions = new API.Completions(this);
        this.chat = new API.Chat(this);
        this.embeddings = new API.Embeddings(this);
        this.files = new API.Files(this);
        this.images = new API.Images(this);
        this.audio = new API.Audio(this);
        this.moderations = new API.Moderations(this);
        this.models = new API.Models(this);
        this.fineTuning = new API.FineTuning(this);
        this.beta = new API.Beta(this);
        this.batches = new API.Batches(this);
        this._options = options;
        this.apiKey = apiKey;
        this.organization = organization;
        this.project = project;
    }
    defaultQuery() {
        return this._options.defaultQuery;
    }
    defaultHeaders(opts) {
        return {
            ...super.defaultHeaders(opts),
            'OpenAI-Organization': this.organization,
            'OpenAI-Project': this.project,
            ...this._options.defaultHeaders
        };
    }
    authHeaders(opts) {
        return {
            Authorization: `Bearer ${this.apiKey}`
        };
    }
}
exports.OpenAI = OpenAI;
_a = OpenAI;
OpenAI.OpenAI = _a;
OpenAI.OpenAIError = Errors.OpenAIError;
OpenAI.APIError = Errors.APIError;
OpenAI.APIConnectionError = Errors.APIConnectionError;
OpenAI.APIConnectionTimeoutError = Errors.APIConnectionTimeoutError;
OpenAI.APIUserAbortError = Errors.APIUserAbortError;
OpenAI.NotFoundError = Errors.NotFoundError;
OpenAI.ConflictError = Errors.ConflictError;
OpenAI.RateLimitError = Errors.RateLimitError;
OpenAI.BadRequestError = Errors.BadRequestError;
OpenAI.AuthenticationError = Errors.AuthenticationError;
OpenAI.InternalServerError = Errors.InternalServerError;
OpenAI.PermissionDeniedError = Errors.PermissionDeniedError;
OpenAI.UnprocessableEntityError = Errors.UnprocessableEntityError;
exports.OpenAIError = Errors.OpenAIError, exports.APIError = Errors.APIError, exports.APIConnectionError = Errors.APIConnectionError, exports.APIConnectionTimeoutError = Errors.APIConnectionTimeoutError, exports.APIUserAbortError = Errors.APIUserAbortError, exports.NotFoundError = Errors.NotFoundError, exports.ConflictError = Errors.ConflictError, exports.RateLimitError = Errors.RateLimitError, exports.BadRequestError = Errors.BadRequestError, exports.AuthenticationError = Errors.AuthenticationError, exports.InternalServerError = Errors.InternalServerError, exports.PermissionDeniedError = Errors.PermissionDeniedError, exports.UnprocessableEntityError = Errors.UnprocessableEntityError;
exports.toFile = Uploads.toFile;
exports.fileFromPath = Uploads.fileFromPath;
(function(OpenAI) {
    // Helper functions
    OpenAI.toFile = Uploads.toFile;
    OpenAI.fileFromPath = Uploads.fileFromPath;
    OpenAI.Page = Pagination.Page;
    OpenAI.CursorPage = Pagination.CursorPage;
    OpenAI.Completions = API.Completions;
    OpenAI.Chat = API.Chat;
    OpenAI.Embeddings = API.Embeddings;
    OpenAI.Files = API.Files;
    OpenAI.FileObjectsPage = API.FileObjectsPage;
    OpenAI.Images = API.Images;
    OpenAI.Audio = API.Audio;
    OpenAI.Moderations = API.Moderations;
    OpenAI.Models = API.Models;
    OpenAI.ModelsPage = API.ModelsPage;
    OpenAI.FineTuning = API.FineTuning;
    OpenAI.Beta = API.Beta;
    OpenAI.Batches = API.Batches;
})(OpenAI = exports.OpenAI || (exports.OpenAI = {}));
exports = module.exports = OpenAI;
exports.default = OpenAI; //# sourceMappingURL=index.js.map
}}),

};

//# sourceMappingURL=5cb3c_openai_820abe._.js.map