/*! firebase-admin v13.5.0 */
/*!
 * Copyright 2021 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import * as jwt from 'jsonwebtoken';
import { Agent } from 'http';
export declare const ALGORITHM_RS256: jwt.Algorithm;
export type Dictionary = {
    [key: string]: any;
};
export type DecodedToken = {
    header: Dictionary;
    payload: Dictionary;
};
export interface SignatureVerifier {
    verify(token: string): Promise<void>;
}
interface KeyFetcher {
    fetchPublicKeys(): Promise<{
        [key: string]: string;
    }>;
}
export declare class JwksFetcher implements KeyFetcher {
    private publicKeys;
    private publicKeysExpireAt;
    private client;
    constructor(jwksUrl: string, httpAgent?: Agent);
    fetchPublicKeys(): Promise<{
        [key: string]: string;
    }>;
    private shouldRefresh;
    private refresh;
}
/**
 * Class to fetch public keys from a client certificates URL.
 */
export declare class UrlKeyFetcher implements KeyFetcher {
    private clientCertUrl;
    private readonly httpAgent?;
    private publicKeys;
    private publicKeysExpireAt;
    constructor(clientCertUrl: string, httpAgent?: Agent | undefined);
    /**
     * Fetches the public keys for the Google certs.
     *
     * @returns A promise fulfilled with public keys for the Google certs.
     */
    fetchPublicKeys(): Promise<{
        [key: string]: string;
    }>;
    /**
     * Checks if the cached public keys need to be refreshed.
     *
     * @returns Whether the keys should be fetched from the client certs url or not.
     */
    private shouldRefresh;
    private refresh;
}
/**
 * Class for verifying JWT signature with a public key.
 */
export declare class PublicKeySignatureVerifier implements SignatureVerifier {
    private keyFetcher;
    constructor(keyFetcher: KeyFetcher);
    static withCertificateUrl(clientCertUrl: string, httpAgent?: Agent): PublicKeySignatureVerifier;
    static withJwksUrl(jwksUrl: string, httpAgent?: Agent): PublicKeySignatureVerifier;
    verify(token: string): Promise<void>;
    private verifyWithoutKid;
    private verifyWithAllKeys;
}
/**
 * Class for verifying unsigned (emulator) JWTs.
 */
export declare class EmulatorSignatureVerifier implements SignatureVerifier {
    verify(token: string): Promise<void>;
}
/**
 * Verifies the signature of a JWT using the provided secret or a function to fetch
 * the secret or public key.
 *
 * @param token - The JWT to be verified.
 * @param secretOrPublicKey - The secret or a function to fetch the secret or public key.
 * @param options - JWT verification options.
 * @returns A Promise resolving for a token with a valid signature.
 */
export declare function verifyJwtSignature(token: string, secretOrPublicKey: jwt.Secret | jwt.GetPublicKeyOrSecret, options?: jwt.VerifyOptions): Promise<void>;
/**
 * Decodes general purpose Firebase JWTs.
 *
 * @param jwtToken - JWT token to be decoded.
 * @returns Decoded token containing the header and payload.
 */
export declare function decodeJwt(jwtToken: string): Promise<DecodedToken>;
/**
 * Jwt error code structure.
 *
 * @param code - The error code.
 * @param message - The error message.
 * @constructor
 */
export declare class JwtError extends Error {
    readonly code: JwtErrorCode;
    readonly message: string;
    constructor(code: JwtErrorCode, message: string);
}
/**
 * JWT error codes.
 */
export declare enum JwtErrorCode {
    INVALID_ARGUMENT = "invalid-argument",
    INVALID_CREDENTIAL = "invalid-credential",
    TOKEN_EXPIRED = "token-expired",
    INVALID_SIGNATURE = "invalid-token",
    NO_MATCHING_KID = "no-matching-kid-error",
    NO_KID_IN_HEADER = "no-kid-error",
    KEY_FETCH_ERROR = "key-fetch-error"
}
export {};
