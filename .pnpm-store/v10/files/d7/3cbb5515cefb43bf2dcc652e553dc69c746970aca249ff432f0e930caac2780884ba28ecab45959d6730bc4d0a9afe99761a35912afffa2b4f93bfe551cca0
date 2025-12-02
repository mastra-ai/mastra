"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deserializeAuthenticationResponse = void 0;
const oauth_tokens_serializer_1 = require("./oauth-tokens.serializer");
const user_serializer_1 = require("./user.serializer");
const deserializeAuthenticationResponse = (authenticationResponse) => {
    const { user, organization_id, access_token, refresh_token, authentication_method, impersonator, oauth_tokens } = authenticationResponse, rest = __rest(authenticationResponse, ["user", "organization_id", "access_token", "refresh_token", "authentication_method", "impersonator", "oauth_tokens"]);
    return Object.assign({ user: (0, user_serializer_1.deserializeUser)(user), organizationId: organization_id, accessToken: access_token, refreshToken: refresh_token, impersonator, authenticationMethod: authentication_method, oauthTokens: (0, oauth_tokens_serializer_1.deserializeOauthTokens)(oauth_tokens) }, rest);
};
exports.deserializeAuthenticationResponse = deserializeAuthenticationResponse;
