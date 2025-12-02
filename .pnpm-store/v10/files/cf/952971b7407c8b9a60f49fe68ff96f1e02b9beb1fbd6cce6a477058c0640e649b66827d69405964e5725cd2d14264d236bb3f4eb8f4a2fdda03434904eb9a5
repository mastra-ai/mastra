"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deserializeVerifyResponse = void 0;
const challenge_serializer_1 = require("./challenge.serializer");
const deserializeVerifyResponse = (verifyResponse) => ({
    challenge: (0, challenge_serializer_1.deserializeChallenge)(verifyResponse.challenge),
    valid: verifyResponse.valid,
});
exports.deserializeVerifyResponse = deserializeVerifyResponse;
