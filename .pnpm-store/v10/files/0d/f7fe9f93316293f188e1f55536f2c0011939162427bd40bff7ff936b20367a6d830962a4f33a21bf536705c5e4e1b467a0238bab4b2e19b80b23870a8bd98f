"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scriptSha1 = exports.defineScript = void 0;
const node_crypto_1 = require("node:crypto");
function defineScript(script) {
    return {
        ...script,
        SHA1: scriptSha1(script.SCRIPT)
    };
}
exports.defineScript = defineScript;
function scriptSha1(script) {
    return (0, node_crypto_1.createHash)('sha1').update(script).digest('hex');
}
exports.scriptSha1 = scriptSha1;
//# sourceMappingURL=lua-script.js.map