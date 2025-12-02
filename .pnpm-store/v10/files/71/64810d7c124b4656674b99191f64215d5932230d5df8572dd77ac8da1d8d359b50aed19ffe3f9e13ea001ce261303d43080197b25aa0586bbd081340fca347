// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { version } from './version.js';
let logLevelValue = 'warning';
export const env = {
    wasm: {},
    webgl: {},
    webgpu: {},
    versions: { common: version },
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
Object.defineProperty(env, 'logLevel', { enumerable: true });
//# sourceMappingURL=env-impl.js.map