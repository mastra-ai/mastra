"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deserializeGetTokenResponse = exports.serializeGetTokenOptions = void 0;
const serializeGetTokenOptions = (options) => ({
    organization_id: options.organizationId,
    user_id: options.userId,
    scopes: options.scopes,
});
exports.serializeGetTokenOptions = serializeGetTokenOptions;
const deserializeGetTokenResponse = (data) => ({
    token: data.token,
});
exports.deserializeGetTokenResponse = deserializeGetTokenResponse;
