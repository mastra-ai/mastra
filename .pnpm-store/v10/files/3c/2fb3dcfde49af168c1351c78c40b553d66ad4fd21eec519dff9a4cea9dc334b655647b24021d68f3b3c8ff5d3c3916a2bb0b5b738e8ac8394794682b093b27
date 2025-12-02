"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSupportedBackends = void 0;
__exportStar(require("onnxruntime-common"), exports);
var backend_1 = require("./backend");
Object.defineProperty(exports, "listSupportedBackends", { enumerable: true, get: function () { return backend_1.listSupportedBackends; } });
const onnxruntime_common_1 = require("onnxruntime-common");
const version_1 = require("./version");
const backend_2 = require("./backend");
const backends = (0, backend_2.listSupportedBackends)();
for (const backend of backends) {
    (0, onnxruntime_common_1.registerBackend)(backend.name, backend_2.onnxruntimeBackend, 100);
}
Object.defineProperty(onnxruntime_common_1.env.versions, 'node', { value: version_1.version, enumerable: true });
//# sourceMappingURL=index.js.map