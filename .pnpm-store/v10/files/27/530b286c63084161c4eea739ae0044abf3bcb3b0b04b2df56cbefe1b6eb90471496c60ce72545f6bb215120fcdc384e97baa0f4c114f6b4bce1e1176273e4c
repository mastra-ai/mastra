"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFetch = void 0;
var errors_1 = require("../errors");
var getFetch = function (config) {
    if (config.fetchApi) {
        // User-provided fetch implementation, if any, takes precedence.
        return config.fetchApi;
    }
    else if (global.fetch) {
        // If a fetch implementation is already present in the global
        // scope, use that. This should prevent confusing failures in
        // nextjs projects where @vercel/fetch is mandated and
        // other implementations are stubbed out.
        return global.fetch;
    }
    else {
        throw new errors_1.PineconeConfigurationError('No global or user-provided fetch implementations found. Please supply a fetch implementation.');
    }
};
exports.getFetch = getFetch;
//# sourceMappingURL=fetch.js.map