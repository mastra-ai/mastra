"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const version_js_1 = require("./version.js");
let logLevelValue = 'warning';
exports.env = {
    wasm: {},
    webgl: {},
    webgpu: {},
    versions: { common: version_js_1.version },
    set logLevel(value) {
        if (value === undefined) {
            return;
        }
        if (typeof value !== 'string' || ['verbose', 'info', 'warning', 'error', 'fatal'].indexOf(value) === -1) {
            throw new Error(`Unsupported logging level: ${value}`);
        }
        logLevelValue = value;
    },
    get logLevel() {
        return logLevelValue;
    },
};
// set property 'logLevel' so that they can be correctly transferred to worker by `postMessage()`.
Object.defineProperty(exports.env, 'logLevel', { enumerable: true });
//# sourceMappingURL=env-impl.js.map