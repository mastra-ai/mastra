"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deserializeFactorWithSecrets = exports.deserializeFactor = void 0;
const totp_serializer_1 = require("../../mfa/serializers/totp.serializer");
const deserializeFactor = (factor) => ({
    object: factor.object,
    id: factor.id,
    createdAt: factor.created_at,
    updatedAt: factor.updated_at,
    type: factor.type,
    totp: (0, totp_serializer_1.deserializeTotp)(factor.totp),
    userId: factor.user_id,
});
exports.deserializeFactor = deserializeFactor;
const deserializeFactorWithSecrets = (factor) => ({
    object: factor.object,
    id: factor.id,
    createdAt: factor.created_at,
    updatedAt: factor.updated_at,
    type: factor.type,
    totp: (0, totp_serializer_1.deserializeTotpWithSecrets)(factor.totp),
    userId: factor.user_id,
});
exports.deserializeFactorWithSecrets = deserializeFactorWithSecrets;
