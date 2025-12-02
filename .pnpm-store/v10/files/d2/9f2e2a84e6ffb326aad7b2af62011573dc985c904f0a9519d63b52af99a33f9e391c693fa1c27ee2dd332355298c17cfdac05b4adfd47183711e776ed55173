"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deserializeProfileAndToken = void 0;
const oauth_tokens_serializer_1 = require("../../user-management/serializers/oauth-tokens.serializer");
const profile_serializer_1 = require("./profile.serializer");
const deserializeProfileAndToken = (profileAndToken) => ({
    accessToken: profileAndToken.access_token,
    profile: (0, profile_serializer_1.deserializeProfile)(profileAndToken.profile),
    oauthTokens: (0, oauth_tokens_serializer_1.deserializeOauthTokens)(profileAndToken.oauth_tokens),
});
exports.deserializeProfileAndToken = deserializeProfileAndToken;
