"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deserializePasswordResetEvent = exports.deserializePasswordReset = void 0;
const deserializePasswordReset = (passwordReset) => ({
    object: passwordReset.object,
    id: passwordReset.id,
    userId: passwordReset.user_id,
    email: passwordReset.email,
    passwordResetToken: passwordReset.password_reset_token,
    passwordResetUrl: passwordReset.password_reset_url,
    expiresAt: passwordReset.expires_at,
    createdAt: passwordReset.created_at,
});
exports.deserializePasswordReset = deserializePasswordReset;
const deserializePasswordResetEvent = (passwordReset) => ({
    object: passwordReset.object,
    id: passwordReset.id,
    userId: passwordReset.user_id,
    email: passwordReset.email,
    expiresAt: passwordReset.expires_at,
    createdAt: passwordReset.created_at,
});
exports.deserializePasswordResetEvent = deserializePasswordResetEvent;
