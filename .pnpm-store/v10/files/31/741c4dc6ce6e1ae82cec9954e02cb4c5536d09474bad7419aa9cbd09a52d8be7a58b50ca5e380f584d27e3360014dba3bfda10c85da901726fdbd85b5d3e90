"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BodyInspector = exports.DataBody = exports.StreamBody = exports.JsonBody = exports.Body = void 0;
const crypto_1 = require("crypto");
const already_1 = require("already");
const get_stream_1 = require("get-stream");
const through2 = require("through2");
const toArrayBuffer = require("to-arraybuffer");
const core_1 = require("./core");
const abortError = new core_1.AbortError("Response aborted");
function makeUnknownDataError() {
    return new Error("Unknown body data");
}
function throwIntegrityMismatch() {
    throw new Error("Resource integrity mismatch");
}
function throwLengthMismatch() {
    throw new RangeError("Resource length mismatch (possibly incomplete body)");
}
function parseIntegrity(integrity) {
    const [algorithm, ...expectedHash] = integrity.split("-");
    return { algorithm, hash: expectedHash.join("-") };
}
function isStream(body) {
    return body &&
        ("readable" in Object(body));
}
const emptyBuffer = new ArrayBuffer(0);
class Body {
    constructor() {
        this._length = null;
        this._used = false;
        Object.defineProperties(this, {
            bodyUsed: {
                enumerable: true,
                get: () => this._used,
            },
        });
    }
    async arrayBuffer(allowIncomplete = false) {
        this._ensureUnused();
        this._ensureNotAborted();
        if (this._body == null)
            return this.validateIntegrity(emptyBuffer, allowIncomplete);
        else if (isStream(this._body))
            return this.awaitBuffer(this._body)
                .then(buffer => this.validateIntegrity(buffer, allowIncomplete))
                .then(buffer => toArrayBuffer(buffer));
        else if (Buffer.isBuffer(this._body))
            return this.validateIntegrity(toArrayBuffer(this._body), allowIncomplete);
        else
            throw makeUnknownDataError();
    }
    async formData() {
        throw new Error("Body.formData() is not yet implemented");
    }
    async json() {
        this._ensureUnused();
        this._ensureNotAborted();
        if (this._body == null)
            return Promise.resolve(this.validateIntegrity(emptyBuffer, false))
                .then(() => this._body);
        else if (isStream(this._body))
            return this.awaitBuffer(this._body)
                .then((0, already_1.tap)(buffer => this.validateIntegrity(buffer, false)))
                .then(buffer => JSON.parse(buffer.toString()));
        else if (Buffer.isBuffer(this._body))
            return Promise.resolve(this._body)
                .then((0, already_1.tap)(buffer => this.validateIntegrity(buffer, false)))
                .then(buffer => JSON.parse(buffer.toString()));
        else
            throw makeUnknownDataError();
    }
    async text(allowIncomplete = false) {
        this._ensureUnused();
        this._ensureNotAborted();
        if (this._body == null)
            return Promise.resolve(this.validateIntegrity(emptyBuffer, allowIncomplete))
                .then(() => this._body);
        else if (isStream(this._body))
            return this.awaitBuffer(this._body)
                .then((0, already_1.tap)(buffer => this.validateIntegrity(buffer, allowIncomplete)))
                .then(buffer => buffer.toString());
        else if (Buffer.isBuffer(this._body))
            return Promise.resolve(this._body)
                .then((0, already_1.tap)(buffer => this.validateIntegrity(buffer, allowIncomplete)))
                .then(buffer => buffer.toString());
        else
            throw makeUnknownDataError();
    }
    async readable() {
        this._ensureUnused();
        this._ensureNotAborted();
        if (this._body == null) {
            const stream = through2();
            stream.end();
            return Promise.resolve(stream);
        }
        else if (isStream(this._body))
            return Promise.resolve(this._body);
        else if (Buffer.isBuffer(this._body))
            return Promise.resolve(through2())
                .then(stream => {
                stream.write(this._body);
                stream.end();
                return stream;
            });
        else
            throw makeUnknownDataError();
    }
    setSignal(signal) {
        this._signal = signal;
    }
    hasBody() {
        return "_body" in this;
    }
    setBody(body, mime, integrity, length = null) {
        this._ensureUnused();
        this._length = length;
        this._used = false;
        if (body instanceof Body) {
            body._ensureUnused();
            this._body = body._body;
            this._mime = body._mime;
        }
        else if (typeof body === "string")
            this._body = Buffer.from(body);
        else if (body != null)
            this._body = body;
        else
            this._body = body;
        if (Buffer.isBuffer(this._body))
            this._length = this._body.length;
        if (mime)
            this._mime = mime;
        if (integrity)
            this._integrity = integrity;
    }
    async awaitBuffer(readable) {
        if (!this._signal)
            return (0, get_stream_1.buffer)(readable);
        // Race the readable against the abort signal
        let callback = () => { };
        const onAborted = new Promise((_, reject) => {
            var _a;
            callback = () => { reject(abortError); };
            (_a = this._signal) === null || _a === void 0 ? void 0 : _a.addListener('abort', callback);
        });
        try {
            this._ensureNotAborted();
            return await Promise.race([
                (0, get_stream_1.buffer)(readable),
                onAborted,
            ]);
        }
        finally {
            this._signal.removeListener('abort', callback);
            // Could happen if abort and other error happen practically
            // simultaneously. Ensure Node.js won't get mad about this.
            onAborted.catch(() => { });
        }
    }
    validateIntegrity(data, allowIncomplete) {
        this._ensureNotAborted();
        if (!allowIncomplete &&
            this._length != null &&
            data.byteLength !== this._length)
            throwLengthMismatch();
        if (!this._integrity)
            // This is valid
            return data;
        const { algorithm, hash: expectedHash } = parseIntegrity(this._integrity);
        // jest (I presume) modifies ArrayBuffer, breaking instanceof
        const instanceOfArrayBuffer = (val) => val && val.constructor && val.constructor.name === "ArrayBuffer";
        const hash = (0, crypto_1.createHash)(algorithm)
            .update(instanceOfArrayBuffer(data)
            ? new DataView(data)
            : data)
            .digest("base64");
        if (expectedHash.toLowerCase() !== hash.toLowerCase())
            throwIntegrityMismatch();
        return data;
    }
    _ensureNotAborted() {
        if (this._signal && this._signal.aborted)
            throw abortError;
    }
    _ensureUnused() {
        if (this._used)
            throw new ReferenceError("Body already used");
        this._used = true;
    }
    // @ts-ignore
    async blob() {
        throw new Error("Body.blob() is not implemented (makes no sense in Node.js), " +
            "use another getter.");
    }
}
exports.Body = Body;
class JsonBody extends Body {
    constructor(obj) {
        super();
        const body = Buffer.from(JSON.stringify(obj));
        this.setBody(body, "application/json");
    }
}
exports.JsonBody = JsonBody;
class StreamBody extends Body {
    constructor(readable) {
        super();
        this.setBody(readable);
    }
}
exports.StreamBody = StreamBody;
class DataBody extends Body {
    constructor(data) {
        super();
        this.setBody(data);
    }
}
exports.DataBody = DataBody;
class BodyInspector extends Body {
    constructor(body) {
        super();
        this._ref = body;
    }
    _getMime() {
        return this._mime;
    }
    _getLength() {
        return this._length;
    }
    _getBody() {
        return this._body;
    }
    get mime() {
        return this._getMime.call(this._ref);
    }
    get length() {
        return this._getLength.call(this._ref);
    }
    get stream() {
        const rawBody = this._getBody.call(this._ref);
        return rawBody && isStream(rawBody) ? rawBody : undefined;
    }
}
exports.BodyInspector = BodyInspector;
//# sourceMappingURL=body.js.map