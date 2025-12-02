"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deserializeOauthTokens = void 0;
const deserializeOauthTokens = (oauthTokens) => oauthTokens
    ? {
        accessToken: oauthTokens.access_token,
        refreshToken: oauthTokens.refresh_token,
        expiresAt: oauthTokens.expires_at,
        scopes: oauthTokens.scopes,
    }
    : undefined;
exports.deserializeOauthTokens = deserializeOauthTokens;
