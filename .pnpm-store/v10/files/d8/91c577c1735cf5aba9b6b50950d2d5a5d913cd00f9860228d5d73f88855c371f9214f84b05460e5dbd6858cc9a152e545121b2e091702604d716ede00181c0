"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignJWT = void 0;
const sign_js_1 = require("../jws/compact/sign.js");
const errors_js_1 = require("../util/errors.js");
const buffer_utils_js_1 = require("../lib/buffer_utils.js");
const produce_js_1 = require("./produce.js");
class SignJWT extends produce_js_1.ProduceJWT {
    _protectedHeader;
    setProtectedHeader(protectedHeader) {
        this._protectedHeader = protectedHeader;
        return this;
    }
    async sign(key, options) {
        const sig = new sign_js_1.CompactSign(buffer_utils_js_1.encoder.encode(JSON.stringify(this._payload)));
        sig.setProtectedHeader(this._protectedHeader);
        if (Array.isArray(this._protectedHeader?.crit) &&
            this._protectedHeader.crit.includes('b64') &&
            this._protectedHeader.b64 === false) {
            throw new errors_js_1.JWTInvalid('JWTs MUST NOT use unencoded payload');
        }
        return sig.sign(key, options);
    }
}
exports.SignJWT = SignJWT;
