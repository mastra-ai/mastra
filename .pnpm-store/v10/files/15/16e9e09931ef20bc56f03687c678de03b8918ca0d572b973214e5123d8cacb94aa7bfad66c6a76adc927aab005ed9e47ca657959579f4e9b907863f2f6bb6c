"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.initOrt = exports.binding = void 0;
const onnxruntime_common_1 = require("onnxruntime-common");
// export native binding
exports.binding = 
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
require(`../bin/napi-v3/${process.platform}/${process.arch}/onnxruntime_binding.node`);
let ortInitialized = false;
const initOrt = () => {
    if (!ortInitialized) {
        ortInitialized = true;
        let logLevel = 2;
        if (onnxruntime_common_1.env.logLevel) {
            switch (onnxruntime_common_1.env.logLevel) {
                case 'verbose':
                    logLevel = 0;
                    break;
                case 'info':
                    logLevel = 1;
                    break;
                case 'warning':
                    logLevel = 2;
                    break;
                case 'error':
                    logLevel = 3;
                    break;
                case 'fatal':
                    logLevel = 4;
                    break;
                default:
                    throw new Error(`Unsupported log level: ${onnxruntime_common_1.env.logLevel}`);
            }
        }
        exports.binding.initOrtOnce(logLevel, onnxruntime_common_1.Tensor);
    }
};
exports.initOrt = initOrt;
//# sourceMappingURL=binding.js.map