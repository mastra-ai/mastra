"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _OnnxruntimeSessionHandler_inferenceSession;
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSupportedBackends = exports.onnxruntimeBackend = void 0;
const binding_1 = require("./binding");
class OnnxruntimeSessionHandler {
    constructor(pathOrBuffer, options) {
        _OnnxruntimeSessionHandler_inferenceSession.set(this, void 0);
        (0, binding_1.initOrt)();
        __classPrivateFieldSet(this, _OnnxruntimeSessionHandler_inferenceSession, new binding_1.binding.InferenceSession(), "f");
        if (typeof pathOrBuffer === 'string') {
            __classPrivateFieldGet(this, _OnnxruntimeSessionHandler_inferenceSession, "f").loadModel(pathOrBuffer, options);
        }
        else {
            __classPrivateFieldGet(this, _OnnxruntimeSessionHandler_inferenceSession, "f").loadModel(pathOrBuffer.buffer, pathOrBuffer.byteOffset, pathOrBuffer.byteLength, options);
        }
        this.inputNames = __classPrivateFieldGet(this, _OnnxruntimeSessionHandler_inferenceSession, "f").inputNames;
        this.outputNames = __classPrivateFieldGet(this, _OnnxruntimeSessionHandler_inferenceSession, "f").outputNames;
    }
    async dispose() {
        __classPrivateFieldGet(this, _OnnxruntimeSessionHandler_inferenceSession, "f").dispose();
    }
    startProfiling() {
        // startProfiling is a no-op.
        //
        // if sessionOptions.enableProfiling is true, profiling will be enabled when the model is loaded.
    }
    endProfiling() {
        __classPrivateFieldGet(this, _OnnxruntimeSessionHandler_inferenceSession, "f").endProfiling();
    }
    async run(feeds, fetches, options) {
        return new Promise((resolve, reject) => {
            setImmediate(() => {
                try {
                    resolve(__classPrivateFieldGet(this, _OnnxruntimeSessionHandler_inferenceSession, "f").run(feeds, fetches, options));
                }
                catch (e) {
                    // reject if any error is thrown
                    reject(e);
                }
            });
        });
    }
}
_OnnxruntimeSessionHandler_inferenceSession = new WeakMap();
class OnnxruntimeBackend {
    async init() {
        return Promise.resolve();
    }
    async createInferenceSessionHandler(pathOrBuffer, options) {
        return new Promise((resolve, reject) => {
            setImmediate(() => {
                try {
                    resolve(new OnnxruntimeSessionHandler(pathOrBuffer, options || {}));
                }
                catch (e) {
                    // reject if any error is thrown
                    reject(e);
                }
            });
        });
    }
}
exports.onnxruntimeBackend = new OnnxruntimeBackend();
exports.listSupportedBackends = binding_1.binding.listSupportedBackends;
//# sourceMappingURL=backend.js.map