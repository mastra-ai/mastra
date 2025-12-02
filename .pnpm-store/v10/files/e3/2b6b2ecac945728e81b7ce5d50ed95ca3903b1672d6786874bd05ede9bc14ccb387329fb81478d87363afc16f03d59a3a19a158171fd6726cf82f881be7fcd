"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deserializeFactorWithSecrets = exports.deserializeFactor = void 0;
const sms_serializer_1 = require("./sms.serializer");
const totp_serializer_1 = require("./totp.serializer");
const deserializeFactor = (factor) => (Object.assign(Object.assign({ object: factor.object, id: factor.id, createdAt: factor.created_at, updatedAt: factor.updated_at, type: factor.type }, (factor.sms ? { sms: (0, sms_serializer_1.deserializeSms)(factor.sms) } : {})), (factor.totp ? { totp: (0, totp_serializer_1.deserializeTotp)(factor.totp) } : {})));
exports.deserializeFactor = deserializeFactor;
const deserializeFactorWithSecrets = (factor) => (Object.assign(Object.assign({ object: factor.object, id: factor.id, createdAt: factor.created_at, updatedAt: factor.updated_at, type: factor.type }, (factor.sms ? { sms: (0, sms_serializer_1.deserializeSms)(factor.sms) } : {})), (factor.totp ? { totp: (0, totp_serializer_1.deserializeTotpWithSecrets)(factor.totp) } : {})));
exports.deserializeFactorWithSecrets = deserializeFactorWithSecrets;
