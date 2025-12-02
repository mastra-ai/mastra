"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deserializeTotpWithSecrets = exports.deserializeTotp = void 0;
const deserializeTotp = (totp) => {
    return {
        issuer: totp.issuer,
        user: totp.user,
    };
};
exports.deserializeTotp = deserializeTotp;
const deserializeTotpWithSecrets = (totp) => {
    return {
        issuer: totp.issuer,
        user: totp.user,
        qrCode: totp.qr_code,
        secret: totp.secret,
        uri: totp.uri,
    };
};
exports.deserializeTotpWithSecrets = deserializeTotpWithSecrets;
