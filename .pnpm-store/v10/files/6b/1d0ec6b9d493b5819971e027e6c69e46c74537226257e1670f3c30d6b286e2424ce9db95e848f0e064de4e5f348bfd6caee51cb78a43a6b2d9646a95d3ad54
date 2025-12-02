"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const browserCrypto_1 = require("./browserCrypto");
const isNode = typeof process !== "undefined" &&
    process.versions != null &&
    process.versions.node != null;
let cryptoUtils;
function loadCrypto() {
    if (isNode) {
        try {
            require("node:crypto");
            cryptoUtils = require("./nodeCrypto").cryptoUtils;
        }
        catch (_) {
            if (typeof globalThis.crypto !== "undefined") {
                cryptoUtils = browserCrypto_1.cryptoUtils;
            }
            else {
                throw new Error("No crypto implementation found");
            }
        }
    }
    else {
        cryptoUtils = browserCrypto_1.cryptoUtils;
    }
}
loadCrypto();
exports.default = cryptoUtils;
