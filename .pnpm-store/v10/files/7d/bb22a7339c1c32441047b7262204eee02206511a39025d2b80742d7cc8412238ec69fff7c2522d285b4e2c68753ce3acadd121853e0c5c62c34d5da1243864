export type TokenCarrier = 'header' | 'cookie';
export declare const TokenVerificationErrorCode: {
    InvalidSecretKey: string;
};
export type TokenVerificationErrorCode = (typeof TokenVerificationErrorCode)[keyof typeof TokenVerificationErrorCode];
export declare const TokenVerificationErrorReason: {
    TokenExpired: string;
    TokenInvalid: string;
    TokenInvalidAlgorithm: string;
    TokenInvalidAuthorizedParties: string;
    TokenInvalidSignature: string;
    TokenNotActiveYet: string;
    TokenIatInTheFuture: string;
    TokenVerificationFailed: string;
    InvalidSecretKey: string;
    LocalJWKMissing: string;
    RemoteJWKFailedToLoad: string;
    RemoteJWKInvalid: string;
    RemoteJWKMissing: string;
    JWKFailedToResolve: string;
    JWKKidMismatch: string;
};
export type TokenVerificationErrorReason = (typeof TokenVerificationErrorReason)[keyof typeof TokenVerificationErrorReason];
export declare const TokenVerificationErrorAction: {
    ContactSupport: string;
    EnsureClerkJWT: string;
    SetClerkJWTKey: string;
    SetClerkSecretKey: string;
    EnsureClockSync: string;
};
export type TokenVerificationErrorAction = (typeof TokenVerificationErrorAction)[keyof typeof TokenVerificationErrorAction];
export declare class TokenVerificationError extends Error {
    action?: TokenVerificationErrorAction;
    reason: TokenVerificationErrorReason;
    tokenCarrier?: TokenCarrier;
    constructor({ action, message, reason, }: {
        action?: TokenVerificationErrorAction;
        message: string;
        reason: TokenVerificationErrorReason;
    });
    getFullMessage(): string;
}
export declare class SignJWTError extends Error {
}
//# sourceMappingURL=errors.d.ts.map