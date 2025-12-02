import * as z from "zod/v4";
import { OpenEnum } from "../../types/enums.js";
import { Result as SafeParseResult } from "../../types/fp.js";
import { SDKValidationError } from "../errors/sdkvalidationerror.js";
/**
 * The method used to generate the code challenge
 */
export declare const CreateAuthKeysCodeCodeChallengeMethod: {
    readonly S256: "S256";
    readonly Plain: "plain";
};
/**
 * The method used to generate the code challenge
 */
export type CreateAuthKeysCodeCodeChallengeMethod = OpenEnum<typeof CreateAuthKeysCodeCodeChallengeMethod>;
export type CreateAuthKeysCodeRequest = {
    /**
     * The callback URL to redirect to after authorization. Note, only https URLs on ports 443 and 3000 are allowed.
     */
    callbackUrl: string;
    /**
     * PKCE code challenge for enhanced security
     */
    codeChallenge?: string | undefined;
    /**
     * The method used to generate the code challenge
     */
    codeChallengeMethod?: CreateAuthKeysCodeCodeChallengeMethod | undefined;
    /**
     * Credit limit for the API key to be created
     */
    limit?: number | undefined;
    /**
     * Optional expiration time for the API key to be created
     */
    expiresAt?: Date | null | undefined;
};
/**
 * Auth code data
 */
export type CreateAuthKeysCodeData = {
    /**
     * The authorization code ID to use in the exchange request
     */
    id: string;
    /**
     * The application ID associated with this auth code
     */
    appId: number;
    /**
     * ISO 8601 timestamp of when the auth code was created
     */
    createdAt: string;
};
/**
 * Successfully created authorization code
 */
export type CreateAuthKeysCodeResponse = {
    /**
     * Auth code data
     */
    data: CreateAuthKeysCodeData;
};
/** @internal */
export declare const CreateAuthKeysCodeCodeChallengeMethod$outboundSchema: z.ZodType<string, CreateAuthKeysCodeCodeChallengeMethod>;
/** @internal */
export type CreateAuthKeysCodeRequest$Outbound = {
    callback_url: string;
    code_challenge?: string | undefined;
    code_challenge_method?: string | undefined;
    limit?: number | undefined;
    expires_at?: string | null | undefined;
};
/** @internal */
export declare const CreateAuthKeysCodeRequest$outboundSchema: z.ZodType<CreateAuthKeysCodeRequest$Outbound, CreateAuthKeysCodeRequest>;
export declare function createAuthKeysCodeRequestToJSON(createAuthKeysCodeRequest: CreateAuthKeysCodeRequest): string;
/** @internal */
export declare const CreateAuthKeysCodeData$inboundSchema: z.ZodType<CreateAuthKeysCodeData, unknown>;
export declare function createAuthKeysCodeDataFromJSON(jsonString: string): SafeParseResult<CreateAuthKeysCodeData, SDKValidationError>;
/** @internal */
export declare const CreateAuthKeysCodeResponse$inboundSchema: z.ZodType<CreateAuthKeysCodeResponse, unknown>;
export declare function createAuthKeysCodeResponseFromJSON(jsonString: string): SafeParseResult<CreateAuthKeysCodeResponse, SDKValidationError>;
//# sourceMappingURL=createauthkeyscode.d.ts.map